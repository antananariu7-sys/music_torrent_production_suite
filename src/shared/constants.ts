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

  // Authentication
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_STATUS: 'auth:status',
  AUTH_DEBUG: 'auth:debug',

  // Search
  SEARCH_START: 'search:start',
  SEARCH_STOP: 'search:stop',
  SEARCH_PROGRESS: 'search:progress',
  SEARCH_RESULTS: 'search:results',
  SEARCH_ERROR: 'search:error',
  SEARCH_OPEN_URL: 'search:open-url',

  // Torrent operations
  TORRENT_DOWNLOAD: 'torrent:download',
  TORRENT_GET_HISTORY: 'torrent:get-history',
  TORRENT_CLEAR_HISTORY: 'torrent:clear-history',
  TORRENT_GET_SETTINGS: 'torrent:get-settings',
  TORRENT_UPDATE_SETTINGS: 'torrent:update-settings',
  TORRENT_PROGRESS: 'torrent:progress',

  // MusicBrainz operations
  MUSICBRAINZ_FIND_ALBUMS: 'musicbrainz:find-albums',
  MUSICBRAINZ_GET_ALBUM: 'musicbrainz:get-album',
  MUSICBRAINZ_CREATE_QUERY: 'musicbrainz:create-query',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // File operations
  FILE_SELECT_DIRECTORY: 'file:select-directory',
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
