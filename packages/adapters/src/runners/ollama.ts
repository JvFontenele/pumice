import type { Command } from '@pumice/types'
import { BaseAgentRunner, type CommandChunk, type RunnerOptions } from '../runner.js'
import type { IAgentAdapter } from '@pumice/agent-sdk'

export interface OllamaRunnerOptions extends RunnerOptions {
  /** Ollama base URL. Default: http://localhost:11434. */
  baseUrl?: string
  /** Model name to use. Default: 'llama3'. */
  model?: string
}

interface OllamaStreamChunk {
  model: string
  response: string
  done: boolean
}

/**
 * Runs commands using a local Ollama instance.
 * Requires Ollama to be running (`ollama serve`).
 */
export class OllamaRunner extends BaseAgentRunner {
  private baseUrl: string
  private model: string

  constructor(adapter: IAgentAdapter, opts: OllamaRunnerOptions = {}) {
    super(adapter, opts)
    this.baseUrl = opts.baseUrl ?? 'http://localhost:11434'
    this.model = opts.model ?? 'llama3'
  }

  protected async *executeCommand(
    command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk> {
    const payload = JSON.parse(command.payload) as { prompt?: string; input?: string }
    const prompt = payload.prompt ?? payload.input ?? command.payload

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: true }),
      signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const chunk = JSON.parse(trimmed) as OllamaStreamChunk
          yield { text: chunk.response, done: chunk.done }
          if (chunk.done) return
        } catch {
          // Ignore non-JSON lines
        }
      }
    }

    yield { text: '', done: true }
  }
}
