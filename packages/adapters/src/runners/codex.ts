import { spawn } from 'child_process'
import type { Command } from '@pumice/types'
import { BaseAgentRunner, type CommandChunk, type RunnerOptions } from '../runner.js'
import type { IAgentAdapter } from '@pumice/agent-sdk'

export interface CodexRunnerOptions extends RunnerOptions {
  /** Path to the codex CLI binary. Default: 'codex'. */
  bin?: string
  extraArgs?: string[]
}

/**
 * Runs commands using the OpenAI Codex CLI.
 * Requires `codex` to be installed and authenticated (OPENAI_API_KEY).
 */
export class CodexRunner extends BaseAgentRunner {
  private bin: string
  private extraArgs: string[]

  constructor(adapter: IAgentAdapter, opts: CodexRunnerOptions = {}) {
    super(adapter, opts)
    this.bin = opts.bin ?? 'codex'
    this.extraArgs = opts.extraArgs ?? []
  }

  protected async *executeCommand(
    command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    const payload = JSON.parse(command.payload) as { prompt?: string; input?: string }
    const prompt = payload.prompt ?? payload.input ?? command.payload

    // codex CLI: `codex --approval-mode full-auto "<prompt>"`
    const args = ['--approval-mode', 'full-auto', prompt, ...this.extraArgs]
    const proc = spawn(this.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    signal.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true })

    let output = ''
    for await (const raw of proc.stdout) {
      if (signal.aborted) break
      const chunk = (raw as Buffer).toString('utf8')
      output += chunk
      yield { text: chunk, done: false }
    }

    await new Promise<void>((resolve) => proc.on('close', resolve))
    yield { text: '', done: true }
  }
}
