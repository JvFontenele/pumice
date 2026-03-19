// ─── Timeout ──────────────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/**
 * Races a promise against a timeout.
 * Throws TimeoutError if the deadline is exceeded.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (v) => { clearTimeout(id); resolve(v) },
      (e) => { clearTimeout(id); reject(e) },
    )
  })
}

// ─── Retry with exponential backoff ──────────────────────────────────────────

export interface RetryOptions {
  maxRetries: number
  /** Base delay in ms; doubles each attempt. Default 200. */
  backoffMs?: number
  /** Maximum delay cap in ms. Default 10_000. */
  maxBackoffMs?: number
  /** Called before each retry. */
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Calls fn() and retries up to maxRetries times on failure,
 * with exponential backoff between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { maxRetries, backoffMs = 200, maxBackoffMs = 10_000, onRetry } = opts
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxRetries) break
      onRetry?.(attempt + 1, err)
      const delay = Math.min(backoffMs * 2 ** attempt, maxBackoffMs)
      await sleep(delay)
    }
  }

  throw lastError
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
