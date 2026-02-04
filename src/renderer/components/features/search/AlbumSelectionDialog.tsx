import React, { useState } from 'react'
import type { MusicBrainzAlbum, SearchClassificationResult } from '@shared/types/musicbrainz.types'

interface AlbumSelectionDialogProps {
  isOpen: boolean
  albums: MusicBrainzAlbum[]
  selectedClassification: SearchClassificationResult | null
  onSelectAlbum: (album: MusicBrainzAlbum) => void
  onSelectDiscography?: () => void
  onCancel: () => void
}

export const AlbumSelectionDialog: React.FC<AlbumSelectionDialogProps> = ({
  isOpen,
  albums,
  selectedClassification,
  onSelectAlbum,
  onSelectDiscography,
  onCancel,
}) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MusicBrainzAlbum | null>(null)

  if (!isOpen) return null

  const isArtistSearch = selectedClassification?.type === 'artist'

  const formatDate = (date?: string): string => {
    if (!date) return 'Unknown'
    const year = date.split('-')[0]
    return year || 'Unknown'
  }

  const getAlbumTypeLabel = (type?: string): string => {
    if (!type) return ''
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const handleSelectAlbum = (album: MusicBrainzAlbum) => {
    setSelectedAlbum(album)
  }

  const handleConfirm = () => {
    if (selectedAlbum) {
      onSelectAlbum(selectedAlbum)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[80vh] flex flex-col rounded-lg bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">
            {isArtistSearch ? 'Select an Album' : 'Which Album Contains This Song?'}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {selectedClassification && (
              <>
                Found {albums.length} album{albums.length !== 1 ? 's' : ''} for{' '}
                <span className="font-medium text-white">{selectedClassification.name}</span>
                {selectedClassification.artist && (
                  <> by {selectedClassification.artist}</>
                )}
              </>
            )}
          </p>
        </div>

        {isArtistSearch && onSelectDiscography && (
          <div className="mb-4">
            <button
              onClick={onSelectDiscography}
              className="w-full rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 p-4 text-left transition-all hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">📀</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-400">Download Complete Discography</h3>
                  <p className="text-sm text-gray-400">
                    Search RuTracker for all albums by {selectedClassification?.name}
                  </p>
                </div>
                <svg
                  className="h-6 w-6 text-blue-500"
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
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => handleSelectAlbum(album)}
              className={`w-full rounded-lg border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                selectedAlbum?.id === album.id
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">💿</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{album.title}</h3>
                    {album.type && (
                      <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                        {getAlbumTypeLabel(album.type)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">by {album.artist}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>📅 {formatDate(album.date)}</span>
                    {album.trackCount && <span>🎵 {album.trackCount} tracks</span>}
                    {album.score && <span>✨ {album.score}% match</span>}
                  </div>
                </div>
                {selectedAlbum?.id === album.id && (
                  <div className="text-blue-500">
                    <svg
                      className="h-6 w-6"
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
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedAlbum}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search RuTracker
          </button>
        </div>
      </div>
    </div>
  )
}
