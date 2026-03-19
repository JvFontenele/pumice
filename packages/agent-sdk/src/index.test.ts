import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IAgentAdapter, RegisterPayload, PostResponsePayload } from './index'
import { isAgentAdapter } from './index'
import type { Command, AgentStatus } from '@pumice/types'

// ─── Mock adapter implementing the full contract ───────────────────────────────

class MockAgentAdapter implements IAgentAdapter {
  private commands: Command[] = []

  async register(payload: RegisterPayload) {
    return {
      agentId: 'mock-agent-id',
      token: 'mock-token',
    }
  }

  async heartbeat(_agentId: string): Promise<void> {
    // no-op in mock
  }

  async pullCommands(_agentId: string): Promise<Command[]> {
    return this.commands
  }

  async postResponse(_payload: PostResponsePayload): Promise<void> {
    // no-op in mock
  }

  async updateStatus(_agentId: string, _status: AgentStatus): Promise<void> {
    // no-op in mock
  }

  // Test helper
  _injectCommand(cmd: Command) {
    this.commands.push(cmd)
  }
}

// ─── Conformance tests ─────────────────────────────────────────────────────────

describe('IAgentAdapter conformance', () => {
  let adapter: MockAgentAdapter

  beforeEach(() => {
    adapter = new MockAgentAdapter()
  })

  it('isAgentAdapter recognizes a valid implementation', () => {
    expect(isAgentAdapter(adapter)).toBe(true)
  })

  it('isAgentAdapter rejects plain objects missing methods', () => {
    expect(isAgentAdapter({})).toBe(false)
    expect(isAgentAdapter({ register: vi.fn() })).toBe(false)
    expect(isAgentAdapter(null)).toBe(false)
  })

  it('register returns agentId and token', async () => {
    const result = await adapter.register({
      name: 'Test Agent',
      provider: 'claude',
      capabilities: ['code'],
    })
    expect(result).toHaveProperty('agentId')
    expect(result).toHaveProperty('token')
    expect(typeof result.agentId).toBe('string')
    expect(typeof result.token).toBe('string')
  })

  it('heartbeat resolves without error', async () => {
    await expect(adapter.heartbeat('mock-agent-id')).resolves.toBeUndefined()
  })

  it('pullCommands returns an array', async () => {
    const cmds = await adapter.pullCommands('mock-agent-id')
    expect(Array.isArray(cmds)).toBe(true)
  })

  it('pullCommands returns injected commands', async () => {
    const cmd: Command = {
      id: '123e4567-e89b-12d3-a456-426614174003',
      runId: '123e4567-e89b-12d3-a456-426614174002',
      target: 'mock-agent-id',
      payload: 'Do something',
      status: 'delivered',
    }
    adapter._injectCommand(cmd)
    const cmds = await adapter.pullCommands('mock-agent-id')
    expect(cmds).toHaveLength(1)
    expect(cmds[0].id).toBe(cmd.id)
  })

  it('postResponse resolves without error for partial response', async () => {
    await expect(
      adapter.postResponse({
        commandId: '123e4567-e89b-12d3-a456-426614174003',
        agentId: 'mock-agent-id',
        output: 'Working...',
        partial: true,
      })
    ).resolves.toBeUndefined()
  })

  it('postResponse resolves without error for final response', async () => {
    await expect(
      adapter.postResponse({
        commandId: '123e4567-e89b-12d3-a456-426614174003',
        agentId: 'mock-agent-id',
        output: 'Done! Here is the result.',
        artifacts: ['src/output.ts'],
        partial: false,
      })
    ).resolves.toBeUndefined()
  })

  it('updateStatus resolves without error', async () => {
    await expect(adapter.updateStatus('mock-agent-id', 'working')).resolves.toBeUndefined()
    await expect(adapter.updateStatus('mock-agent-id', 'idle')).resolves.toBeUndefined()
    await expect(adapter.updateStatus('mock-agent-id', 'error')).resolves.toBeUndefined()
  })
})
