import { spawn } from 'child_process'
import type { Command } from '@pumice/types'
import { BaseAgentRunner, type CommandChunk, type RunnerOptions } from '../runner.js'
import type { IAgentAdapter } from '@pumice/agent-sdk'

export interface ClaudeRunnerOptions extends RunnerOptions {
  /** Path to the claude CLI binary. Default: 'claude' (assumes it's on PATH). */
  bin?: string
  /** Extra flags passed to every invocation, e.g. ['--model', 'claude-opus-4-5']. */
  extraArgs?: string[]
}

/**
 * Runs commands using the Claude CLI (`claude -p "<prompt>"`).
 * Requires `claude` to be installed and authenticated.
 */
export class ClaudeRunner extends BaseAgentRunner {
  private bin: string
  private extraArgs: string[]

  constructor(adapter: IAgentAdapter, opts: ClaudeRunnerOptions = {}) {
    super(adapter, opts)
    this.bin = opts.bin ?? 'claude'
    this.extraArgs = opts.extraArgs ?? []
  }

  protected async *executeCommand(
    command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    const payload = JSON.parse(command.payload) as { prompt?: string; input?: string }
    const prompt = payload.prompt ?? payload.input ?? command.payload

    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...this.extraArgs]
    const proc = spawn(this.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    signal.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true })

    let buffer = ''

    for await (const raw of proc.stdout) {
      if (signal.aborted) break
      buffer += (raw as Buffer).toString('utf8')

      // claude --output-format stream-json emits one JSON object per line
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const obj = JSON.parse(trimmed) as Record<string, unknown>
          // content_block_delta events carry the streamed text
          if (obj.type === 'content_block_delta') {
            const delta = obj.delta as Record<string, unknown> | undefined
            const text = (delta?.text as string) ?? ''
            if (text) yield { text, done: false }
          } else if (obj.type === 'result') {
            // Final result event — emit with done: true
            const text = (obj.result as string) ?? ''
            yield { text, done: true }
            return
          }
        } catch {
          // Non-JSON line — skip
        }
      }
    }

    // If we exit without a result event, emit the remaining buffer as final
    if (buffer.trim()) yield { text: buffer.trim(), done: true }
    else yield { text: '', done: true }

    await new Promise<void>((resolve) => proc.on('close', resolve))
  }
}
