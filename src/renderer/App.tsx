import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, Spinner, VStack, Text } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'
import ProjectLauncher from '@/pages/ProjectLauncher'
import ProjectOverview from '@/pages/ProjectOverview'
import Settings from '@/pages/Settings'
import { useThemeStore } from '@/store/useThemeStore'
import { useAuthStore } from '@/store/useAuthStore'

function AppContent() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const mode = useThemeStore((state) => state.mode)
  const setAuthState = useAuthStore((state) => state.setAuthState)

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  useEffect(() => {
    // Initialize app: get app info and sync auth state
    const initializeApp = async () => {
      try {
        // Get app info
        const info = await window.api.getAppInfo()
        setAppInfo(info)

        // Sync auth state from main process (handles session restoration)
        const authResponse = await window.api.auth.getStatus()
        if (authResponse.success && authResponse.data) {
          console.log('[App] Syncing auth state from main process:', authResponse.data)
          setAuthState(authResponse.data)

          if (authResponse.data.isSessionRestored) {
            console.log('[App] ✅ Session restored successfully')
          }
        }
      } catch (error) {
        console.error('[App] Failed to initialize app:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [setAuthState])

  if (loading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="bg.canvas">
        <VStack gap={4}>
          <Spinner size="xl" color="brand.500" />
          <Text fontSize="xl" color="text.secondary">
            Loading...
          </Text>
        </VStack>
      </Box>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<ProjectLauncher appInfo={appInfo} />} />
      <Route path="/project" element={<ProjectOverview appInfo={appInfo} />} />
      <Route path="/settings" element={<Settings appInfo={appInfo} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </HashRouter>
  )
}

export default App
