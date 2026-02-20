import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/useProjectStore'

/**
 * Hook that triggers batch BPM detection for all songs in the active project.
 * Only fires if there are songs without BPM data. Results are persisted
 * by the BpmDetector service to project.json.
 */
export function useBpmData(projectId: string | undefined): void {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const currentProject = useProjectStore((s) => s.currentProject)
  const loadedProjectRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || !currentProject) return
    if (loadedProjectRef.current === projectId) return

    // Check if all songs already have BPM data
    const songsWithFiles = currentProject.songs.filter((s) => s.localFilePath || s.externalFilePath)
    const allHaveBpm = songsWithFiles.every((s) => s.bpm != null)
    if (songsWithFiles.length === 0 || allHaveBpm) {
      loadedProjectRef.current = projectId
      return
    }

    loadedProjectRef.current = projectId

    // Subscribe to progress events
    const cleanupProgress = window.api.bpm.onProgress(() => {
      // Progress events are informational; UI doesn't show BPM loading progress
    })

    // Start batch detection
    window.api.bpm.detectBatch({ projectId }).then((response) => {
      if (response.success && response.data) {
        // Re-fetch the project to get updated BPM fields on songs
        window.api.openProject({
          filePath: currentProject.projectDirectory,
        }).then((projectResponse) => {
          if (projectResponse.success && projectResponse.data) {
            setCurrentProject(projectResponse.data)
          }
        })
      }
    }).catch(() => {
      // BPM detection is best-effort; failures don't block the UI
    })

    return () => {
      cleanupProgress()
    }
  }, [projectId, currentProject, setCurrentProject])
}
