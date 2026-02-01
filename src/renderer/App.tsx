import { useEffect, useState } from 'react'
import type { AppInfo } from '../shared/types/app.types'
import Welcome from './pages/Welcome'

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get app info on mount
    window.api
      .getAppInfo()
      .then((info) => {
        setAppInfo(info)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Failed to get app info:', error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="app-loading">
        <h1>Loading...</h1>
      </div>
    )
  }

  return (
    <div className="app">
      <Welcome appInfo={appInfo} />
    </div>
  )
}

export default App
