import { useEffect, useState } from 'react'
import { Box, Spinner, VStack, Text } from '@chakra-ui/react'
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
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.900">
        <VStack gap={4}>
          <Spinner size="xl" color="brand.500" />
          <Text fontSize="xl" color="gray.400">
            Loading...
          </Text>
        </VStack>
      </Box>
    )
  }

  return <Welcome appInfo={appInfo} />
}

export default App
