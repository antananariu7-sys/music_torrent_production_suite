import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/useProjectStore'

/**
 * Hook that triggers batch key detection for all songs in the active project.
 * Only fires if there are songs without musicalKey data. Results are persisted
 * by the KeyDetector service to project.json.
 */
export function useKeyData(projectId: string | undefined): void {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const currentProject = useProjectStore((s) => s.currentProject)
  const loadedProjectRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || !currentProject) return
    if (loadedProjectRef.current === projectId) return

    // Check if all songs already have key data
    const songsWithFiles = currentProject.songs.filter(
      (s) => s.localFilePath || s.externalFilePath
    )
    const allHaveKey = songsWithFiles.every(
      (s) => s.musicalKey != null && s.musicalKey !== ''
    )
    if (songsWithFiles.length === 0 || allHaveKey) {
      loadedProjectRef.current = projectId
      return
    }

    loadedProjectRef.current = projectId

    // Subscribe to progress events
    const cleanupProgress = window.api.key.onProgress(() => {
      // Progress events are informational; UI doesn't show key loading progress
    })

    // Start batch detection
    window.api.key
      .detectBatch({ projectId })
      .then((response) => {
        if (response.success && response.data) {
          // Re-fetch the project to get updated musicalKey fields on songs
          window.api
            .openProject({
              filePath: currentProject.projectDirectory,
            })
            .then((projectResponse) => {
              if (projectResponse.success && projectResponse.data) {
                setCurrentProject(projectResponse.data)
              }
            })
        }
      })
      .catch(() => {
        // Key detection is best-effort; failures don't block the UI
      })

    return () => {
      cleanupProgress()
    }
  }, [projectId, currentProject, setCurrentProject])
}
