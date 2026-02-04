import React, { useState } from 'react'
import { useSmartSearchStore } from '@/store/smartSearchStore'

interface SmartSearchBarProps {
  placeholder?: string
  className?: string
}

export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  placeholder = 'Search for artist, album, or song...',
  className = '',
}) => {
  const [query, setQuery] = useState('')
  const { startSearch, isLoading, step } = useSmartSearchStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return
    if (isLoading) return

    startSearch(query.trim())
  }

  const handleClear = () => {
    setQuery('')
  }

  const isActive = step !== 'idle' && step !== 'completed' && step !== 'error'

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <div className="animate-spin">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
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
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className={`w-full rounded-lg border bg-gray-800 py-3 pl-12 pr-24 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
            isActive
              ? 'border-blue-500 ring-2 ring-blue-500'
              : 'border-gray-700 focus:border-blue-500 focus:ring-blue-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {/* Clear/Search Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Status indicator */}
      {isActive && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-gray-400">
            {step === 'classifying' && 'Classifying search...'}
            {step === 'user-choice' && "Choose what you're searching for"}
            {step === 'selecting-album' && 'Select an album'}
            {step === 'searching-rutracker' && 'Searching RuTracker...'}
            {step === 'selecting-torrent' && 'Select a torrent'}
            {step === 'downloading' && 'Downloading torrent file...'}
          </span>
        </div>
      )}
    </form>
  )
}
