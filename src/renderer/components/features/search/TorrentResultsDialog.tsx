import React, { useState } from 'react'
import type { SearchResult } from '@shared/types/search.types'

interface TorrentResultsDialogProps {
  isOpen: boolean
  query: string
  results: SearchResult[]
  onSelectTorrent: (torrent: SearchResult) => void
  onCancel: () => void
  isDownloading?: boolean
}

export const TorrentResultsDialog: React.FC<TorrentResultsDialogProps> = ({
  isOpen,
  query,
  results,
  onSelectTorrent,
  onCancel,
  isDownloading = false,
}) => {
  const [selectedTorrent, setSelectedTorrent] = useState<SearchResult | null>(null)

  if (!isOpen) return null

  const handleSelectTorrent = (torrent: SearchResult) => {
    setSelectedTorrent(torrent)
  }

  const handleDownload = () => {
    if (selectedTorrent) {
      onSelectTorrent(selectedTorrent)
    }
  }

  const getFormatBadgeColor = (format?: string): string => {
    switch (format?.toLowerCase()) {
      case 'flac':
      case 'alac':
      case 'ape':
        return 'bg-green-600'
      case 'mp3':
        return 'bg-blue-600'
      case 'wav':
        return 'bg-purple-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getRelevanceColor = (score?: number): string => {
    if (!score) return 'text-gray-500'
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-blue-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-gray-400'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[85vh] flex flex-col rounded-lg bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">Select Torrent to Download</h2>
          <p className="mt-1 text-sm text-gray-400">
            Found {results.length} torrent{results.length !== 1 ? 's' : ''} for{' '}
            <span className="font-medium text-white">{query}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectTorrent(result)}
              disabled={isDownloading}
              className={`w-full rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${
                selectedTorrent?.id === result.id
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white flex-1">{result.title}</h3>
                    {selectedTorrent?.id === result.id && (
                      <div className="text-blue-500">
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-gray-400">by {result.author}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {result.format && (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium uppercase text-white ${getFormatBadgeColor(result.format)}`}
                      >
                        {result.format}
                      </span>
                    )}
                    {result.category && (
                      <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                        {result.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">📦 {result.size}</span>
                    <span className="text-xs text-green-400">⬆ {result.seeders} seeders</span>
                    <span className="text-xs text-gray-500">⬇ {result.leechers} leechers</span>
                    {result.relevanceScore !== undefined && (
                      <span className={`text-xs font-medium ${getRelevanceColor(result.relevanceScore)}`}>
                        ⭐ {result.relevanceScore}% match
                      </span>
                    )}
                  </div>

                  {result.uploadDate && (
                    <div className="mt-1 text-xs text-gray-600">
                      Uploaded: {new Date(result.uploadDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {isDownloading && (
          <div className="mb-4 rounded-lg bg-blue-500/10 border border-blue-500 p-3 flex items-center gap-3">
            <div className="animate-spin">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <span className="text-sm text-blue-400">Downloading torrent file...</span>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDownloading}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!selectedTorrent || isDownloading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                Downloading...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Torrent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
