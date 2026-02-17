import { retryWithBackoff } from './retryWithBackoff'

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /**
   * Helper to advance timers for pending setTimeout calls
   */
  async function flushPromisesAndTimers() {
    // Flush pending microtasks
    await Promise.resolve()
    // Advance all pending timers
    jest.runAllTimers()
    // Flush again for any newly scheduled microtasks
    await Promise.resolve()
  }

  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success')

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
    })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure then succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    })

    // Advance through retries
    await flushPromisesAndTimers()
    await flushPromisesAndTimers()

    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should respect maxRetries limit', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'))

    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    })

    // Advance through all retries
    await flushPromisesAndTimers()
    await flushPromisesAndTimers()
    await flushPromisesAndTimers()

    await expect(promise).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should call onRetry callback with attempt info', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('success')

    const onRetry = jest.fn()

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      onRetry,
    })

    await flushPromisesAndTimers()

    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
    expect(onRetry.mock.calls[0][1].message).toBe('fail 1')
    // Delay should be between 750-1000 (baseDelay * jitter)
    expect(onRetry.mock.calls[0][2]).toBeGreaterThanOrEqual(750)
    expect(onRetry.mock.calls[0][2]).toBeLessThanOrEqual(1000)
  })

  it('should not retry when retryOn returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('client error'))

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      retryOn: () => false,
    })

    await expect(promise).rejects.toThrow('client error')
    expect(fn).toHaveBeenCalledTimes(1) // no retries
  })

  it('should selectively retry based on retryOn predicate', async () => {
    const retryableError = new Error('server error')
    ;(retryableError as any).status = 503

    const fn = jest.fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('success')

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      retryOn: (error) => (error as any).status >= 500,
    })

    await flushPromisesAndTimers()

    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw last error after all retries exhausted', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))

    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    })

    await flushPromisesAndTimers()
    await flushPromisesAndTimers()
    await flushPromisesAndTimers()

    await expect(promise).rejects.toThrow('fail 3')
  })

  it('should handle non-Error throws', async () => {
    const fn = jest.fn().mockRejectedValue('string error')

    const promise = retryWithBackoff(fn, {
      maxRetries: 0,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    })

    await expect(promise).rejects.toThrow('string error')
  })
})
