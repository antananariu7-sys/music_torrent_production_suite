import { useEffect, useCallback } from 'react'
import { HStack, IconButton } from '@chakra-ui/react'
import { FiRotateCcw, FiRotateCw } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'

/**
 * Global undo/redo keyboard handler + optional toolbar buttons.
 * Mount once at the app root (e.g. Layout) for keyboard-only mode.
 *
 * Shortcuts: Ctrl+Z → undo, Ctrl+Shift+Z / Ctrl+Y → redo
 */
export function UndoRedoBar({
  showButtons = false,
}: {
  showButtons?: boolean
}): JSX.Element | null {
  const handleUndo = useCallback(() => {
    useProjectStore.temporal.getState().undo()
  }, [])

  const handleRedo = useCallback(() => {
    useProjectStore.temporal.getState().redo()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  if (!showButtons) return null

  return (
    <HStack gap={1}>
      <IconButton
        size="2xs"
        variant="ghost"
        onClick={handleUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <FiRotateCcw />
      </IconButton>
      <IconButton
        size="2xs"
        variant="ghost"
        onClick={handleRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <FiRotateCw />
      </IconButton>
    </HStack>
  )
}
