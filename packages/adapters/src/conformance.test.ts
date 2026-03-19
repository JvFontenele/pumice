/**
 * Conformance suite for @pumice/adapters
 *
 * Tests:
 *  1. HttpAdapter satisfies IAgentAdapter at the type/structural level
 *  2. withTimeout / withRetry utility behaviour
 *  3. BaseAgentRunner lifecycle using a fully in-memory mock (no HTTP, no subprocess)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isAgentAdapter } from '@pumice/agent-sdk'
import type { IAgentAdapter, RegisterPayload, PostResponsePayload } from '@pumice/agent-sdk'
import type { Command, AgentStatus } from '@pumice/types'
import { HttpAdapter } from './http-adapter.js'
import { withTimeout, withRetry, TimeoutError, sleep } from './utils.js'
import { BaseAgentRunner, type CommandChunk } from './runner.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'cmd-1',
    runId: 'run-1',
    target: 'agent-1',
    payload: JSON.stringify({ prompt: 'hello' }),
    status: 'queued',
    ...overrides,
  }
}

/**
 * Fully in-memory IAgentAdapter — no HTTP.
 * Captures all calls for assertion in tests.
 */
class MockAdapter implements IAgentAdapter {
  calls: { method: string; args: unknown[] }[] = []
  commandQueue: Command[] = []
  registeredId = 'mock-agent-id'
  registeredToken = 'mock-token'

  private _record(method: string, args: unknown[]) {
    this.calls.push({ method, args })
  }

  async register(payload: RegisterPayload) {
    this._record('register', [payload])
    return { agentId: this.registeredId, token: this.registeredToken }
  }

  async heartbeat(agentId: string) {
    this._record('heartbeat', [agentId])
  }

  async pullCommands(agentId: string): Promise<Command[]> {
    this._record('pullCommands', [agentId])
    const cmds = [...this.commandQueue]
    this.commandQueue = []
    return cmds
  }

  async postResponse(payload: PostResponsePayload) {
    this._record('postResponse', [payload])
  }

  async updateStatus(agentId: string, status: AgentStatus) {
    this._record('updateStatus', [agentId, status])
  }
}

/**
 * Minimal runner that echo-streams the prompt back in two chunks.
 */
class EchoRunner extends BaseAgentRunner {
  protected async *executeCommand(
    command: Command,
    _signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    const payload = JSON.parse(command.payload) as { prompt: string }
    yield { text: 'echo: ', done: false }
    yield { text: payload.prompt, done: true }
  }
}

/**
 * Runner that always throws.
 */
class FailRunner extends BaseAgentRunner {
  protected async *executeCommand(
    _command: Command,
    _signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    throw new Error('deliberate failure')
    // eslint-disable-next-line no-unreachable
    yield { text: '', done: true }
  }
}

/**
 * Runner that hangs forever — used to test timeout.
 */
class HangRunner extends BaseAgentRunner {
  protected async *executeCommand(
    _command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    await new Promise<void>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
    yield { text: '', done: true }
  }
}

// ─── IAgentAdapter structural conformance ─────────────────────────────────────

describe('IAgentAdapter conformance', () => {
  it('HttpAdapter satisfies IAgentAdapter (isAgentAdapter)', () => {
    const adapter = new HttpAdapter({ baseUrl: 'http://localhost:3001' })
    expect(isAgentAdapter(adapter)).toBe(true)
  })

  it('MockAdapter satisfies IAgentAdapter', () => {
    expect(isAgentAdapter(new MockAdapter())).toBe(true)
  })

  it('plain object missing methods fails isAgentAdapter', () => {
    expect(isAgentAdapter({ register: () => {} })).toBe(false)
  })
})

// ─── withTimeout ──────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves if promise completes in time', async () => {
    const result = await withTimeout(Promise.resolve(42), 500)
    expect(result).toBe(42)
  })

  it('throws TimeoutError when deadline exceeded', async () => {
    const never = new Promise<never>(() => {})
    await expect(withTimeout(never, 10)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('TimeoutError message includes the ms', async () => {
    const never = new Promise<never>(() => {})
    await expect(withTimeout(never, 50)).rejects.toThrow('50ms')
  })
})

// ─── withRetry ────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on 3rd attempt', async () => {
    let attempt = 0
    const fn = vi.fn().mockImplementation(async () => {
      attempt++
      if (attempt < 3) throw new Error('fail')
      return 'done'
    })
    const result = await withRetry(fn, { maxRetries: 3, backoffMs: 1 })
    expect(result).toBe('done')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(
      withRetry(fn, { maxRetries: 2, backoffMs: 1 }),
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3) // 1 original + 2 retries
  })

  it('calls onRetry with attempt number and error', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValue('ok')

    await withRetry(fn, { maxRetries: 3, backoffMs: 1, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error))
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error))
  })
})

// ─── BaseAgentRunner lifecycle ────────────────────────────────────────────────

describe('BaseAgentRunner', () => {
  let adapter: MockAdapter
  let runner: EchoRunner

  beforeEach(() => {
    adapter = new MockAdapter()
    runner = new EchoRunner(adapter, {
      heartbeatIntervalMs: 60_000, // don't fire during test
      pollIntervalMs: 50,
    })
  })

  it('registers and sets status to idle on start', async () => {
    await runner.start({ name: 'echo', provider: 'claude', capabilities: [] })

    const registerCall = adapter.calls.find((c) => c.method === 'register')
    expect(registerCall).toBeDefined()
    expect(registerCall?.args[0]).toMatchObject({ name: 'echo' })

    const statusCalls = adapter.calls.filter((c) => c.method === 'updateStatus')
    expect(statusCalls[0]?.args[1]).toBe('idle')

    await runner.stop()
  })

  it('processes a command and posts final response', async () => {
    await runner.start({ name: 'echo', provider: 'claude', capabilities: [] })

    // Enqueue a command
    adapter.commandQueue.push(makeCommand())

    // Wait for poll + execution
    await sleep(300)
    await runner.stop()

    const responseCalls = adapter.calls.filter((c) => c.method === 'postResponse')
    // Should have at least one partial and one final
    const final = responseCalls.find((c) => {
      const p = c.args[0] as PostResponsePayload
      return !p.partial
    })
    expect(final).toBeDefined()
    const payload = final!.args[0] as PostResponsePayload
    expect(payload.output).toContain('hello')
    expect(payload.failed).toBeFalsy()
  })

  it('posts a failed response when executeCommand throws', async () => {
    const failRunner = new FailRunner(adapter, { heartbeatIntervalMs: 60_000, pollIntervalMs: 50 })
    await failRunner.start({ name: 'fail', provider: 'claude', capabilities: [] })

    adapter.commandQueue.push(makeCommand())
    await sleep(300)
    await failRunner.stop()

    const responseCalls = adapter.calls.filter((c) => c.method === 'postResponse')
    const failedResp = responseCalls.find((c) => {
      const p = c.args[0] as PostResponsePayload
      return p.failed === true
    })
    expect(failedResp).toBeDefined()
    expect((failedResp!.args[0] as PostResponsePayload).output).toContain('deliberate failure')
  })

  it('posts a failed response on timeout', async () => {
    const hangRunner = new HangRunner(adapter, {
      heartbeatIntervalMs: 60_000,
      pollIntervalMs: 50,
      commandTimeoutMs: 100, // very short timeout
    })
    await hangRunner.start({ name: 'hang', provider: 'claude', capabilities: [] })

    adapter.commandQueue.push(makeCommand())
    await sleep(500)
    await hangRunner.stop()

    const responseCalls = adapter.calls.filter((c) => c.method === 'postResponse')
    const timedOut = responseCalls.find((c) => {
      const p = c.args[0] as PostResponsePayload
      return p.failed === true && p.output.toLowerCase().includes('timed out')
    })
    expect(timedOut).toBeDefined()
  })

  it('sets status to working while processing and back to idle after', async () => {
    await runner.start({ name: 'echo', provider: 'claude', capabilities: [] })
    adapter.commandQueue.push(makeCommand())

    await sleep(300)
    await runner.stop()

    const statusCalls = adapter.calls
      .filter((c) => c.method === 'updateStatus')
      .map((c) => c.args[1] as string)

    expect(statusCalls).toContain('working')
    // idle appears after working
    const workingIdx = statusCalls.lastIndexOf('working')
    const idleAfter = statusCalls.slice(workingIdx + 1)
    expect(idleAfter).toContain('idle')
  })
})
