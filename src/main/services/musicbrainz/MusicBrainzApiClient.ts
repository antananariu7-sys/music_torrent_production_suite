import { retryWithBackoff } from '../utils/retryWithBackoff'

interface HttpError extends Error { status?: number }

/**
 * MusicBrainzApiClient
 *
 * Shared HTTP client for MusicBrainz API requests.
 * Handles rate limiting (1 req/sec) and retry logic.
 */
export class MusicBrainzApiClient {
  readonly API_BASE = 'https://musicbrainz.org/ws/2'
  readonly COVER_ART_BASE = 'https://coverartarchive.org/release'
  private readonly USER_AGENT = 'MusicProductionSuite/1.0.0 (https://github.com/yourrepo)'
  private readonly RATE_LIMIT_MS = 1000

  private lastRequestTime = 0

  getCoverArtUrl(albumId: string): string {
    return `${this.COVER_ART_BASE}/${albumId}/front-250`
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest
      console.log(`[MusicBrainzService] Rate limiting: waiting ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }

  async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    await this.respectRateLimit()

    const url = new URL(`${this.API_BASE}/${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    console.log(`[MusicBrainzService] Requesting: ${url.toString()}`)

    return retryWithBackoff(
      async () => {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.USER_AGENT,
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          const error = new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`)
          ;(error as HttpError).status = response.status
          throw error
        }

        return response.json() as Promise<T>
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 8000,
        retryOn: (error) => {
          const status = (error as HttpError).status
          return !status || status === 429 || status >= 500
        },
        onRetry: (attempt, error, delay) => {
          console.warn(`[MusicBrainzService] Retry ${attempt}/3: ${error.message}, waiting ${delay}ms`)
        },
      },
    )
  }
}
