import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, Spinner, VStack, Text } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'
import ProjectLauncher from '@/pages/ProjectLauncher'
import ProjectOverview from '@/pages/ProjectOverview'
import Settings from '@/pages/Settings'
import { useThemeStore } from '@/store/useThemeStore'

function AppContent() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const mode = useThemeStore((state) => state.mode)

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

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
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}

export default App
