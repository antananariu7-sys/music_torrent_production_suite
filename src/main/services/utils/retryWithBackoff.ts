/**
 * Options for retry with exponential backoff
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Base delay in milliseconds (doubled on each retry) */
  baseDelayMs: number
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number
  /** Optional predicate to decide if an error is retryable (default: all errors) */
  retryOn?: (error: Error) => boolean
  /** Optional callback called before each retry */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  const capped = Math.min(exponentialDelay, maxDelayMs)
  // Add jitter: 75-100% of the calculated delay
  const jitter = 0.75 + Math.random() * 0.25
  return Math.round(capped * jitter)
}

/**
 * Execute an async function with exponential backoff retry
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryOn, onRetry } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      if (attempt >= maxRetries) {
        break
      }

      if (retryOn && !retryOn(lastError)) {
        break
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs)

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}
