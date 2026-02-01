import type { AppInfo } from '../../shared/types/app.types'

interface WelcomeProps {
  appInfo: AppInfo | null
}

function Welcome({ appInfo }: WelcomeProps) {
  return (
    <div className="welcome-page">
      <div className="welcome-header">
        <h1>🎵 Music Production Suite</h1>
        <p className="welcome-subtitle">
          Integrated torrent search, download management, and mixing capabilities
        </p>
      </div>

      <div className="welcome-content">
        <div className="feature-card">
          <h2>🔍 Component 1: Torrent Search</h2>
          <p>Automated RuTracker search with batch processing and real-time progress</p>
          <button className="btn-primary" disabled>
            Coming Soon
          </button>
        </div>

        <div className="feature-card">
          <h2>📥 Component 2: Download Manager</h2>
          <p>WebTorrent-based downloads with queue management and seeding</p>
          <button className="btn-primary" disabled>
            Coming Soon
          </button>
        </div>

        <div className="feature-card">
          <h2>🎚️ Component 3: Music Mixer</h2>
          <p>Audio mixing and editing interface (Architecture TBD)</p>
          <button className="btn-primary" disabled>
            Coming Soon
          </button>
        </div>
      </div>

      {appInfo && (
        <div className="app-info">
          <p>
            Version {appInfo.version} • {appInfo.platform} ({appInfo.arch})
          </p>
        </div>
      )}
    </div>
  )
}

export default Welcome
