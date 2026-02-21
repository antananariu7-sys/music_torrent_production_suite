/**
 * Minimal type declarations for webtorrent@2.8.5
 * Only covers the API surface used by WebTorrentService.
 */
declare module 'webtorrent' {
  import { EventEmitter } from 'events'

  interface WebTorrentOptions {
    maxConns?: number
    uploadLimit?: number
    downloadLimit?: number
    dht?: boolean | object
    tracker?: boolean | object
    lsd?: boolean
    webSeeds?: boolean
  }

  interface AddTorrentOptions {
    path?: string
    announce?: string[]
    maxWebConns?: number
  }

  interface TorrentFile {
    name: string
    path: string
    length: number
    downloaded: number
    progress: number
    select(): void
    deselect(): void
    createReadStream(opts?: { start?: number; end?: number }): import('stream').Readable
  }

  interface Wire {
    peerId: string
    type: string
  }

  class Torrent extends EventEmitter {
    readonly infoHash: string
    readonly magnetURI: string
    readonly name: string
    readonly length: number
    readonly downloaded: number
    readonly uploaded: number
    readonly downloadSpeed: number
    readonly uploadSpeed: number
    readonly progress: number
    readonly ratio: number
    readonly numPeers: number
    readonly path: string
    readonly ready: boolean
    readonly done: boolean
    readonly files: TorrentFile[]
    readonly wires: Wire[]

    destroy(opts?: { destroyStore?: boolean }, callback?: () => void): void
    pause(): void
    resume(): void

    on(event: 'metadata', listener: () => void): this
    on(event: 'ready', listener: () => void): this
    on(event: 'done', listener: () => void): this
    on(event: 'download', listener: (bytes: number) => void): this
    on(event: 'upload', listener: (bytes: number) => void): this
    on(event: 'wire', listener: (wire: Wire) => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: 'warning', listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  class WebTorrent extends EventEmitter {
    readonly torrents: Torrent[]
    readonly downloadSpeed: number
    readonly uploadSpeed: number
    readonly ratio: number

    constructor(opts?: WebTorrentOptions)

    add(
      torrentId: string | Buffer,
      opts?: AddTorrentOptions,
      ontorrent?: (torrent: Torrent) => void
    ): Torrent

    remove(
      torrentId: string | Torrent,
      opts?: { destroyStore?: boolean },
      callback?: (err?: Error) => void
    ): void

    destroy(callback?: (err?: Error) => void): void

    throttleDownload(rate: number): void
    throttleUpload(rate: number): void

    on(event: 'torrent', listener: (torrent: Torrent) => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export default WebTorrent
  export { Torrent, TorrentFile, Wire, WebTorrentOptions, AddTorrentOptions }
}
