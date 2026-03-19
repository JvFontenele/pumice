import type { Command } from '@pumice/types'
import type { IAgentAdapter, RegisterPayload } from '@pumice/agent-sdk'
import { sleep, withTimeout, TimeoutError } from './utils.js'

export interface RunnerOptions {
  /** How often to send heartbeats (ms). Default 15_000. */
  heartbeatIntervalMs?: number
  /** How often to poll for new commands (ms). Default 2_000. */
  pollIntervalMs?: number
  /** Max time to wait for a single command execution (ms). Default 60_000. */
  commandTimeoutMs?: number
  /** Max concurrent commands being processed. Default 1 (serial). */
  concurrency?: number
}

export interface CommandChunk {
  text: string
  done: boolean
}

/**
 * Base class for all provider runners.
 *
 * Subclasses must implement `executeCommand()`, which receives a Command
 * and yields streamed text chunks. The runner handles:
 *   - Registration
 *   - Heartbeat loop
 *   - Command polling loop
 *   - Streaming postResponse (partial + final)
 *   - Timeout per command
 *   - Graceful shutdown via stop()
 */
export abstract class BaseAgentRunner {
  protected adapter: IAgentAdapter
  protected agentId: string | null = null

  private opts: Required<RunnerOptions>
  private running = false
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private activeCommands = new Set<string>()

  constructor(adapter: IAgentAdapter, opts: RunnerOptions = {}) {
    this.adapter = adapter
    this.opts = {
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? 15_000,
      pollIntervalMs:      opts.pollIntervalMs      ?? 2_000,
      commandTimeoutMs:    opts.commandTimeoutMs    ?? 60_000,
      concurrency:         opts.concurrency         ?? 1,
    }
  }

  // ─── Abstract ──────────────────────────────────────────────────────────────

  /**
   * Execute a single command and yield chunks of output.
   * The last chunk must have `done: true`.
   * Throw on unrecoverable error — the runner will post a failed response.
   */
  protected abstract executeCommand(
    command: Command,
    signal: AbortSignal,
  ): AsyncGenerator<CommandChunk>

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Register and start the heartbeat + polling loops. */
  async start(payload: RegisterPayload): Promise<void> {
    const reg = await this.adapter.register(payload)
    this.agentId = reg.agentId
    this.running = true

    await this.adapter.updateStatus(this.agentId, 'idle')
    this._scheduleHeartbeat()
    this._pollLoop().catch((err) => {
      console.error('[runner] poll loop crashed:', err)
    })
  }

  /** Gracefully stop the runner. Waits for in-flight commands to finish. */
  async stop(): Promise<void> {
    this.running = false
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer)

    // Wait up to 10s for active commands to drain
    const deadline = Date.now() + 10_000
    while (this.activeCommands.size > 0 && Date.now() < deadline) {
      await sleep(200)
    }

    if (this.agentId) {
      await this.adapter.updateStatus(this.agentId, 'offline').catch(() => {})
    }
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────────

  private _scheduleHeartbeat(): void {
    if (!this.running) return
    this.heartbeatTimer = setTimeout(async () => {
      if (this.agentId) {
        await this.adapter.heartbeat(this.agentId).catch((err) => {
          console.warn('[runner] heartbeat failed:', err)
        })
      }
      this._scheduleHeartbeat()
    }, this.opts.heartbeatIntervalMs)
  }

  // ─── Poll loop ─────────────────────────────────────────────────────────────

  private async _pollLoop(): Promise<void> {
    while (this.running) {
      if (this.activeCommands.size < this.opts.concurrency && this.agentId) {
        try {
          const commands = await this.adapter.pullCommands(this.agentId)
          for (const cmd of commands) {
            if (this.activeCommands.size >= this.opts.concurrency) break
            if (this.activeCommands.has(cmd.id)) continue
            this.activeCommands.add(cmd.id)
            // Fire-and-forget; errors are caught inside
            this._handleCommand(cmd).finally(() => {
              this.activeCommands.delete(cmd.id)
            })
          }
        } catch (err) {
          console.warn('[runner] pullCommands failed:', err)
        }
      }

      await sleep(this.opts.pollIntervalMs)
    }
  }

  // ─── Command handler ───────────────────────────────────────────────────────

  private async _handleCommand(command: Command): Promise<void> {
    if (!this.agentId) return

    const ac = new AbortController()
    await this.adapter.updateStatus(this.agentId, 'working').catch(() => {})

    try {
      let output = ''

      const execution = withTimeout(
        this._stream(command, ac.signal, (chunk) => {
          output += chunk
        }),
        this.opts.commandTimeoutMs,
      )

      await execution

      await this.adapter.postResponse({
        commandId: command.id,
        agentId: this.agentId,
        output,
        partial: false,
      })
    } catch (err) {
      ac.abort()
      const message = err instanceof TimeoutError
        ? `Command timed out after ${this.opts.commandTimeoutMs}ms`
        : err instanceof Error ? err.message : String(err)

      await this.adapter.postResponse({
        commandId: command.id,
        agentId: this.agentId,
        output: message,
        partial: false,
        failed: true,
      }).catch(() => {})
    } finally {
      await this.adapter.updateStatus(this.agentId, 'idle').catch(() => {})
    }
  }

  /**
   * Drives the executeCommand generator, posting partial responses
   * and calling onChunk for each text chunk.
   */
  private async _stream(
    command: Command,
    signal: AbortSignal,
    onChunk: (text: string) => void,
  ): Promise<void> {
    if (!this.agentId) return
    const gen = this.executeCommand(command, signal)

    for await (const chunk of gen) {
      if (signal.aborted) break
      onChunk(chunk.text)

      if (!chunk.done) {
        // Post partial streaming update
        await this.adapter.postResponse({
          commandId: command.id,
          agentId: this.agentId!,
          output: chunk.text,
          partial: true,
        }).catch(() => {})
      }
    }
  }
}
