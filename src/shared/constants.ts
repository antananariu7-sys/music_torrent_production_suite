// Application constants and IPC channel names

// IPC Channels
export const IPC_CHANNELS = {
  // App lifecycle
  APP_READY: 'app:ready',
  APP_QUIT: 'app:quit',

  // Project management
  PROJECT_CREATE: 'project:create',
  PROJECT_LOAD: 'project:load',
  PROJECT_SAVE: 'project:save',
  PROJECT_CLOSE: 'project:close',
  PROJECT_LIST: 'project:list',
  PROJECT_DELETE: 'project:delete',
  PROJECT_DELETE_FROM_DISK: 'project:delete-from-disk',

  // Authentication
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_STATUS: 'auth:status',
  AUTH_DEBUG: 'auth:debug',

  // Search
  SEARCH_START: 'search:start',
  SEARCH_START_PROGRESSIVE: 'search:start-progressive',
  SEARCH_STOP: 'search:stop',
  SEARCH_PROGRESS: 'search:progress',
  SEARCH_RESULTS: 'search:results',
  SEARCH_ERROR: 'search:error',
  SEARCH_OPEN_URL: 'search:open-url',
  SEARCH_LOAD_MORE: 'search:load-more',

  // Duplicate detection
  DUPLICATE_CHECK: 'duplicate:check',
  DUPLICATE_RESCAN: 'duplicate:rescan',

  // Torrent operations
  TORRENT_DOWNLOAD: 'torrent:download',
  TORRENT_GET_HISTORY: 'torrent:get-history',
  TORRENT_CLEAR_HISTORY: 'torrent:clear-history',
  TORRENT_GET_SETTINGS: 'torrent:get-settings',
  TORRENT_UPDATE_SETTINGS: 'torrent:update-settings',
  TORRENT_PROGRESS: 'torrent:progress',

  // Torrent local file check
  TORRENT_CHECK_LOCAL_FILE: 'torrent:check-local-file',

  // Torrent metadata parsing
  TORRENT_PARSE_METADATA: 'torrent:parse-metadata',

  // Torrent collection operations
  TORRENT_COLLECTION_LOAD: 'torrent:collection:load',
  TORRENT_COLLECTION_SAVE: 'torrent:collection:save',
  TORRENT_COLLECTION_CLEAR: 'torrent:collection:clear',

  // WebTorrent download queue
  WEBTORRENT_ADD: 'webtorrent:add',
  WEBTORRENT_PAUSE: 'webtorrent:pause',
  WEBTORRENT_RESUME: 'webtorrent:resume',
  WEBTORRENT_REMOVE: 'webtorrent:remove',
  WEBTORRENT_GET_ALL: 'webtorrent:get-all',
  WEBTORRENT_GET_SETTINGS: 'webtorrent:get-settings',
  WEBTORRENT_UPDATE_SETTINGS: 'webtorrent:update-settings',
  WEBTORRENT_PROGRESS: 'webtorrent:progress',
  WEBTORRENT_STATUS_CHANGE: 'webtorrent:status-change',
  WEBTORRENT_SELECT_FILES: 'webtorrent:select-files',
  WEBTORRENT_DOWNLOAD_MORE_FILES: 'webtorrent:download-more-files',
  WEBTORRENT_FILE_SELECTION_NEEDED: 'webtorrent:file-selection-needed',
  WEBTORRENT_PARSE_TORRENT_FILES: 'webtorrent:parse-torrent-files',

  // MusicBrainz operations
  MUSICBRAINZ_FIND_ALBUMS: 'musicbrainz:find-albums',
  MUSICBRAINZ_GET_ALBUM: 'musicbrainz:get-album',
  MUSICBRAINZ_CREATE_QUERY: 'musicbrainz:create-query',
  MUSICBRAINZ_CLASSIFY_SEARCH: 'musicbrainz:classify-search',
  MUSICBRAINZ_GET_ARTIST_ALBUMS: 'musicbrainz:get-artist-albums',

  // Discography search operations
  DISCOGRAPHY_SEARCH: 'discography:search',
  DISCOGRAPHY_SEARCH_PROGRESS: 'discography:search-progress',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // WebTorrent per-project download path
  WEBTORRENT_GET_DOWNLOAD_PATH: 'webtorrent:get-download-path',
  WEBTORRENT_SET_DOWNLOAD_PATH: 'webtorrent:set-download-path',

  // File operations
  FILE_SELECT_DIRECTORY: 'file:select-directory',
  FILE_OPEN_PATH: 'file:open-path',
  FILE_SELECT_AUDIO_FILES: 'file:select-audio-files',

  // Audio playback
  AUDIO_READ_FILE: 'audio:read-file',
  AUDIO_READ_METADATA: 'audio:read-metadata',

  // Audio mix export
  MIX_EXPORT_START: 'mix-export:start',
  MIX_EXPORT_CANCEL: 'mix-export:cancel',
  MIX_EXPORT_PROGRESS: 'mix-export:progress',
  MIX_EXPORT_FFMPEG_CHECK: 'mix-export:ffmpeg-check',

  // Mix / Song management
  PROJECT_ADD_SONG: 'project:add-song',
  PROJECT_REMOVE_SONG: 'project:remove-song',
  PROJECT_UPDATE_SONG: 'project:update-song',
  PROJECT_REORDER_SONGS: 'project:reorder-songs',
  PROJECT_SYNC_AUDIO_FOLDER: 'project:sync-audio-folder',

  // Waveform extraction
  WAVEFORM_GENERATE: 'waveform:generate',
  WAVEFORM_GENERATE_BATCH: 'waveform:generate-batch',
  WAVEFORM_REBUILD_BATCH: 'waveform:rebuild-batch',
  WAVEFORM_PROGRESS: 'waveform:progress',

  // BPM detection
  BPM_DETECT: 'bpm:detect',
  BPM_DETECT_BATCH: 'bpm:detect-batch',
  BPM_DETECT_SONG: 'bpm:detect-song',
  BPM_PROGRESS: 'bpm:progress',

  // Key detection
  KEY_DETECT: 'key:detect',
  KEY_DETECT_BATCH: 'key:detect-batch',
  KEY_DETECT_SONG: 'key:detect-song',
  KEY_PROGRESS: 'key:progress',

  // Stream preview
  STREAM_PREVIEW_START: 'stream-preview:start',
  STREAM_PREVIEW_STOP: 'stream-preview:stop',
  STREAM_PREVIEW_READY: 'stream-preview:ready',
  STREAM_PREVIEW_FULL_READY: 'stream-preview:full-ready',
  STREAM_PREVIEW_ERROR: 'stream-preview:error',
  STREAM_PREVIEW_BUFFERING: 'stream-preview:buffering',

  // Section detection
  SECTION_DETECT: 'section:detect',
  SECTION_DETECT_BATCH: 'section:detect-batch',
  SECTION_PROGRESS: 'section:progress',
} as const

// Application settings
export const APP_CONFIG = {
  APP_NAME: 'Music Production Suite',
  APP_VERSION: '0.1.0',
  MIN_WINDOW_WIDTH: 1024,
  MIN_WINDOW_HEIGHT: 768,
  DEFAULT_WINDOW_WIDTH: 1400,
  DEFAULT_WINDOW_HEIGHT: 900,
} as const

// File paths
export const PATHS = {
  USER_DATA: 'userData',
  PROJECTS: 'projects',
  DOWNLOADS: 'downloads',
  LOGS: 'logs',
} as const
