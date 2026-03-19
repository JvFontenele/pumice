import { spawn } from 'child_process'
import type { Command } from '@pumice/types'
import { BaseAgentRunner, type CommandChunk, type RunnerOptions } from '../runner.js'
import type { IAgentAdapter } from '@pumice/agent-sdk'

export interface GeminiRunnerOptions extends RunnerOptions {
  /** Path to the gemini CLI binary. Default: 'gemini'. */
  bin?: string
  extraArgs?: string[]
}

/**
 * Runs commands using the Google Gemini CLI.
 * Requires `gemini` to be installed and authenticated (GEMINI_API_KEY).
 */
export class GeminiRunner extends BaseAgentRunner {
  private bin: string
  private extraArgs: string[]

  constructor(adapter: IAgentAdapter, opts: GeminiRunnerOptions = {}) {
    super(adapter, opts)
    this.bin = opts.bin ?? 'gemini'
    this.extraArgs = opts.extraArgs ?? []
  }

  protected async *executeCommand(
    command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    const payload = JSON.parse(command.payload) as { prompt?: string; input?: string }
    const prompt = payload.prompt ?? payload.input ?? command.payload

    // gemini CLI: `gemini -p "<prompt>"`
    const args = ['-p', prompt, ...this.extraArgs]
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
