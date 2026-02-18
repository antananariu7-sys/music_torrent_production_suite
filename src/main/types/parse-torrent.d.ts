/**
 * Minimal type declarations for parse-torrent
 * Only covers the API surface used by WebTorrentService.parseTorrentFiles()
 */
declare module 'parse-torrent' {
  interface ParsedTorrentFile {
    path: string
    name: string
    length: number
    offset: number
  }

  interface ParsedTorrent {
    name?: string
    infoHash?: string
    infoHashBuffer?: Buffer
    infoBuffer?: Buffer
    files?: ParsedTorrentFile[]
    length?: number
    pieceLength?: number
    lastPieceLength?: number
    pieces?: string[]
    announce?: string[]
    urlList?: string[]
  }

  function parseTorrent(torrentId: string | Buffer | Uint8Array): Promise<ParsedTorrent>

  export default parseTorrent
  export { ParsedTorrent, ParsedTorrentFile }
}
