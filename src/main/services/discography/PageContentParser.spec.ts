import { describe, it, expect, beforeEach } from '@jest/globals'
import { parsePageContent, scanSinglePage } from './PageContentParser'
import type { SearchResult } from '@shared/types/search.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockPage(evaluateResult: Record<string, unknown> = {}) {
  return {
    evaluate: jest.fn().mockResolvedValue({
      allAlbums: [],
      matchedAlbums: [],
      albumFound: false,
      isDiscography: false,
      pageTitle: 'Test Page',
      ...evaluateResult,
    }),
    setViewport: jest.fn().mockResolvedValue(undefined),
    setCookie: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }
}

function makeMockBrowser(page?: ReturnType<typeof makeMockPage>) {
  return {
    newPage: jest.fn().mockResolvedValue(page ?? makeMockPage()),
  }
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'sr-1',
    title: 'Test Result',
    author: 'author',
    size: '500 MB',
    seeders: 10,
    leechers: 2,
    url: 'https://rutracker.org/forum/viewtopic.php?t=123',
    ...overrides,
  }
}

const defaultCookies = [
  {
    name: 'bb_session',
    value: 'abc123',
    domain: '.rutracker.org',
    path: '/',
    expires: -1,
  },
]

// ---------------------------------------------------------------------------
// parsePageContent
// ---------------------------------------------------------------------------

describe('parsePageContent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns albumFound: true and populates matchedAlbums when the page has a match', async () => {
    const matchedAlbum = {
      title: 'The Dark Side of the Moon',
      year: '1973',
      rawText: '1973 - The Dark Side of the Moon (00:43:00)',
      duration: '00:43:00',
      releaseInfo: undefined,
    }
    const page = makeMockPage({
      allAlbums: [matchedAlbum],
      matchedAlbums: [matchedAlbum],
      albumFound: true,
      isDiscography: false,
      pageTitle: 'Pink Floyd Discography',
    })

    const result = await parsePageContent(
      page as any,
      'The Dark Side of the Moon'
    )

    expect(result.albumFound).toBe(true)
    expect(result.matchedAlbums).toHaveLength(1)
    expect(result.matchedAlbums[0].title).toBe('The Dark Side of the Moon')
    expect(result.matchedAlbums[0].year).toBe('1973')
    expect(result.pageTitle).toBe('Pink Floyd Discography')
  })

  it('returns albumFound: false and empty matchedAlbums when no album matches', async () => {
    const unrelatedAlbum = {
      title: 'Animals',
      year: '1977',
      rawText: '1977 - Animals',
    }
    const page = makeMockPage({
      allAlbums: [unrelatedAlbum],
      matchedAlbums: [],
      albumFound: false,
      isDiscography: false,
      pageTitle: 'Pink Floyd Page',
    })

    const result = await parsePageContent(page as any, 'The Wall')

    expect(result.albumFound).toBe(false)
    expect(result.matchedAlbums).toHaveLength(0)
  })

  it('returns albumFound: true via full-text fallback when album name is in page text', async () => {
    // No structured matchedAlbums, but albumFound still true via full-text search
    const page = makeMockPage({
      allAlbums: [],
      matchedAlbums: [],
      albumFound: true,
      isDiscography: false,
      pageTitle: 'Some Page',
    })

    const result = await parsePageContent(page as any, 'Wish You Were Here')

    expect(result.albumFound).toBe(true)
    expect(result.matchedAlbums).toHaveLength(0)
  })

  it('returns all albums in allAlbums when multiple albums are found on the page', async () => {
    const albums = [
      {
        title: 'The Piper At The Gates Of Dawn',
        year: '1967',
        rawText: '1967 - The Piper At The Gates Of Dawn',
      },
      {
        title: 'A Saucerful of Secrets',
        year: '1968',
        rawText: '1968 - A Saucerful of Secrets',
      },
      { title: 'More', year: '1969', rawText: '1969 - More' },
      { title: 'Ummagumma', year: '1969', rawText: '1969 - Ummagumma' },
    ]
    const page = makeMockPage({
      allAlbums: albums,
      matchedAlbums: [],
      albumFound: false,
      isDiscography: true,
      pageTitle: 'Pink Floyd Discography',
    })

    const result = await parsePageContent(page as any, 'Atom Heart Mother')

    expect(result.allAlbums).toHaveLength(4)
    expect(result.allAlbums[0].title).toBe('The Piper At The Gates Of Dawn')
    expect(result.allAlbums[3].year).toBe('1969')
  })

  it('returns isDiscography: true when the page contains discography keywords', async () => {
    const page = makeMockPage({
      allAlbums: [],
      matchedAlbums: [],
      albumFound: false,
      isDiscography: true,
      pageTitle: 'Pink Floyd - Discography',
    })

    const result = await parsePageContent(page as any, 'Animals')

    expect(result.isDiscography).toBe(true)
  })

  it('returns isDiscography: true when more than 3 albums are found', async () => {
    const albums = Array.from({ length: 5 }, (_, i) => ({
      title: `Album ${i + 1}`,
      year: `${1970 + i}`,
      rawText: `${1970 + i} - Album ${i + 1}`,
    }))
    const page = makeMockPage({
      allAlbums: albums,
      matchedAlbums: [],
      albumFound: false,
      isDiscography: true,
      pageTitle: 'Artist Page',
    })

    const result = await parsePageContent(page as any, 'Some Album')

    expect(result.isDiscography).toBe(true)
  })

  it('returns albumFound: false and isDiscography: false for an empty page', async () => {
    const page = makeMockPage({
      allAlbums: [],
      matchedAlbums: [],
      albumFound: false,
      isDiscography: false,
      pageTitle: 'Unknown',
    })

    const result = await parsePageContent(page as any, 'Animals')

    expect(result.albumFound).toBe(false)
    expect(result.isDiscography).toBe(false)
    expect(result.allAlbums).toHaveLength(0)
    expect(result.matchedAlbums).toHaveLength(0)
  })

  it('returns albumFound: true when both album name and artist name match', async () => {
    const matchedAlbum = {
      title: 'OK Computer',
      year: '1997',
      rawText: '1997 - OK Computer',
    }
    const page = makeMockPage({
      allAlbums: [matchedAlbum],
      matchedAlbums: [matchedAlbum],
      albumFound: true,
      isDiscography: false,
      pageTitle: 'Radiohead Page',
    })

    const result = await parsePageContent(
      page as any,
      'OK Computer',
      'Radiohead'
    )

    expect(result.albumFound).toBe(true)
    expect(result.matchedAlbums).toHaveLength(1)
    expect(result.matchedAlbums[0].title).toBe('OK Computer')
  })

  it('returns albums with year, duration, and releaseInfo properly forwarded', async () => {
    const detailedAlbum = {
      title: 'The Piper At The Gates Of Dawn',
      year: '1967',
      rawText:
        '1967 - The Piper At The Gates Of Dawn (1987, EMI CDP 7 46384 2, UK) (00:41:44)',
      duration: '00:41:44',
      releaseInfo: '1987, EMI CDP 7 46384 2, UK',
    }
    const page = makeMockPage({
      allAlbums: [detailedAlbum],
      matchedAlbums: [detailedAlbum],
      albumFound: true,
      isDiscography: false,
      pageTitle: 'Pink Floyd',
    })

    const result = await parsePageContent(page as any, 'Piper')

    expect(result.matchedAlbums[0].year).toBe('1967')
    expect(result.matchedAlbums[0].duration).toBe('00:41:44')
    expect(result.matchedAlbums[0].releaseInfo).toBe(
      '1987, EMI CDP 7 46384 2, UK'
    )
    expect(result.matchedAlbums[0].rawText).toContain('EMI')
  })

  it('forwards arguments to page.evaluate', async () => {
    const page = makeMockPage()

    await parsePageContent(page as any, 'The Wall', 'Pink Floyd')

    expect(page.evaluate).toHaveBeenCalledTimes(1)
    const callArgs = (page.evaluate as jest.Mock).mock.calls[0]
    // First arg is the function, second is albumName, third is artistName
    expect(callArgs[1]).toBe('The Wall')
    expect(callArgs[2]).toBe('Pink Floyd')
  })
})

// ---------------------------------------------------------------------------
// scanSinglePage
// ---------------------------------------------------------------------------

describe('scanSinglePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets cookies, navigates to URL, and returns parse result merged with searchResult', async () => {
    const matchedAlbum = {
      title: 'Wish You Were Here',
      year: '1975',
      rawText: '1975 - Wish You Were Here',
    }
    const page = makeMockPage({
      allAlbums: [matchedAlbum],
      matchedAlbums: [matchedAlbum],
      albumFound: true,
      isDiscography: false,
      pageTitle: 'Pink Floyd - Wish You Were Here',
    })
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult({
      title: 'Pink Floyd - Wish You Were Here',
    })

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Wish You Were Here'
    )

    expect(browser.newPage).toHaveBeenCalledTimes(1)
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 })
    expect(page.setCookie).toHaveBeenCalledTimes(1)
    expect(page.goto).toHaveBeenCalledWith(searchResult.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    expect(result.searchResult).toBe(searchResult)
    expect(result.albumFound).toBe(true)
    expect(result.matchedAlbums).toHaveLength(1)
    expect(result.pageTitle).toBe('Pink Floyd - Wish You Were Here')
    expect(result.error).toBeUndefined()
  })

  it('returns an error result when navigation throws a timeout error', async () => {
    const page = makeMockPage()
    page.goto = jest
      .fn()
      .mockRejectedValue(new Error('Navigation timeout of 30000 ms exceeded'))
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Animals'
    )

    expect(result.albumFound).toBe(false)
    expect(result.matchedAlbums).toHaveLength(0)
    expect(result.allAlbums).toHaveLength(0)
    expect(result.isDiscography).toBe(false)
    expect(result.error).toContain('Navigation timeout')
    expect(result.searchResult).toBe(searchResult)
  })

  it('returns albumFound: false and error when page.close throws after another error', async () => {
    const page = makeMockPage()
    page.goto = jest
      .fn()
      .mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'))
    page.close = jest.fn().mockRejectedValue(new Error('Target closed'))
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Animals'
    )

    // Should still return gracefully even when close() also fails
    expect(result.albumFound).toBe(false)
    expect(result.error).toContain('ERR_CONNECTION_REFUSED')
    expect(result.searchResult).toBe(searchResult)
  })

  it('attaches the original searchResult object to the result', async () => {
    const page = makeMockPage({
      albumFound: true,
      matchedAlbums: [],
      allAlbums: [],
    })
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult({
      id: 'unique-id-42',
      url: 'https://rutracker.org/forum/viewtopic.php?t=999',
    })

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Meddle'
    )

    expect(result.searchResult).toStrictEqual(searchResult)
    expect(result.searchResult.id).toBe('unique-id-42')
  })

  it('skips setCookie call when sessionCookies array is empty', async () => {
    const page = makeMockPage()
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    await scanSinglePage(browser as any, [], searchResult, 'Animals')

    expect(page.setCookie).not.toHaveBeenCalled()
    expect(page.goto).toHaveBeenCalledTimes(1)
  })

  it('uses the provided timeout value for page.goto', async () => {
    const page = makeMockPage()
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'The Wall',
      undefined,
      60000
    )

    expect(page.goto).toHaveBeenCalledWith(searchResult.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
  })

  it('closes the page after a successful scan', async () => {
    const page = makeMockPage()
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Animals'
    )

    expect(page.close).toHaveBeenCalledTimes(1)
  })

  it('uses searchResult.title as pageTitle in the error path', async () => {
    const page = makeMockPage()
    page.goto = jest.fn().mockRejectedValue(new Error('timeout'))
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult({
      title: 'Pink Floyd - Animals (1977)',
    })

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Animals'
    )

    expect(result.pageTitle).toBe('Pink Floyd - Animals (1977)')
  })

  it('handles non-Error thrown values and uses fallback error message', async () => {
    const page = makeMockPage()
    page.goto = jest.fn().mockRejectedValue('string error')
    const browser = makeMockBrowser(page)
    const searchResult = makeSearchResult()

    const result = await scanSinglePage(
      browser as any,
      defaultCookies,
      searchResult,
      'Animals'
    )

    expect(result.error).toBe('Failed to scan page')
  })
})
