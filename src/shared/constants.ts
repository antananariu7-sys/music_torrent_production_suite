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

  // Search
  SEARCH_START: 'search:start',
  SEARCH_STOP: 'search:stop',
  SEARCH_PROGRESS: 'search:progress',
  SEARCH_RESULTS: 'search:results',
  SEARCH_ERROR: 'search:error',

  // Torrent operations
  TORRENT_ADD: 'torrent:add',
  TORRENT_REMOVE: 'torrent:remove',
  TORRENT_PAUSE: 'torrent:pause',
  TORRENT_RESUME: 'torrent:resume',
  TORRENT_PROGRESS: 'torrent:progress',

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
