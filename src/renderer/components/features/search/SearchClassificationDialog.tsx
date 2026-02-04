import React from 'react'
import type { SearchClassificationResult } from '@shared/types/musicbrainz.types'

interface SearchClassificationDialogProps {
  isOpen: boolean
  query: string
  results: SearchClassificationResult[]
  onSelect: (result: SearchClassificationResult) => void
  onCancel: () => void
}

export const SearchClassificationDialog: React.FC<SearchClassificationDialogProps> = ({
  isOpen,
  query,
  results,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'artist':
        return 'Artist'
      case 'album':
        return 'Album'
      case 'song':
        return 'Song'
      default:
        return 'Unknown'
    }
  }

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'artist':
        return '🎤'
      case 'album':
        return '💿'
      case 'song':
        return '🎵'
      default:
        return '❓'
    }
  }

  const getActionDescription = (type: string): string => {
    switch (type) {
      case 'artist':
        return 'Browse albums or download discography'
      case 'album':
        return 'Download this album from RuTracker'
      case 'song':
        return 'Find and download the album containing this song'
      default:
        return ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">What are you searching for?</h2>
          <p className="mt-1 text-sm text-gray-400">
            We found multiple matches for &quot;<span className="font-medium text-white">{query}</span>&quot;.
            Choose what you&apos;re looking for:
          </p>
        </div>

        <div className="space-y-3">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.name}-${index}`}
              onClick={() => onSelect(result)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 p-4 text-left transition-all hover:border-blue-500 hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{getTypeIcon(result.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium uppercase text-white">
                      {getTypeLabel(result.type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {result.score}% match
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-white">{result.name}</h3>
                  {result.artist && result.type !== 'artist' && (
                    <p className="text-sm text-gray-400">by {result.artist}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{getActionDescription(result.type)}</p>
                </div>
                <div className="text-gray-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
