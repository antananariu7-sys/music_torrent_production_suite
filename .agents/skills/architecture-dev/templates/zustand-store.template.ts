// src/renderer/store/use{{STORE_NAME}}Store.ts

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { {{TYPE_NAME}} } from '../../shared/types/{{FEATURE_NAME}}.types'

/**
 * {{STORE_DESCRIPTION}}
 *
 * State:
 * - {{STATE_ITEM_1}}
 * - {{STATE_ITEM_2}}
 *
 * Actions:
 * - {{ACTION_1}}
 * - {{ACTION_2}}
 */

interface {{STORE_NAME}}State {
  // State
  {{DATA_NAME}}: {{TYPE_NAME}}[]
  {{LOADING_NAME}}: boolean
  {{ERROR_NAME}}: string | null
  {{SELECTED_NAME}}: {{TYPE_NAME}} | null

  // Actions
  set{{DATA_NAME}}: ({{DATA_NAME}}: {{TYPE_NAME}}[]) => void
  add{{ITEM_NAME}}: ({{ITEM_NAME}}: {{TYPE_NAME}}) => void
  update{{ITEM_NAME}}: (id: string, updates: Partial<{{TYPE_NAME}}>) => void
  remove{{ITEM_NAME}}: (id: string) => void
  select{{ITEM_NAME}}: ({{ITEM_NAME}}: {{TYPE_NAME}} | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const use{{STORE_NAME}}Store = create<{{STORE_NAME}}State>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        {{DATA_NAME}}: [],
        {{LOADING_NAME}}: false,
        {{ERROR_NAME}}: null,
        {{SELECTED_NAME}}: null,

        // Actions
        set{{DATA_NAME}}: ({{DATA_NAME}}) =>
          set({ {{DATA_NAME}} }),

        add{{ITEM_NAME}}: ({{ITEM_NAME}}) =>
          set((state) => ({
            {{DATA_NAME}}: [...state.{{DATA_NAME}}, {{ITEM_NAME}}]
          })),

        update{{ITEM_NAME}}: (id, updates) =>
          set((state) => ({
            {{DATA_NAME}}: state.{{DATA_NAME}}.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            )
          })),

        remove{{ITEM_NAME}}: (id) =>
          set((state) => ({
            {{DATA_NAME}}: state.{{DATA_NAME}}.filter((item) => item.id !== id),
            {{SELECTED_NAME}}: state.{{SELECTED_NAME}}?.id === id ? null : state.{{SELECTED_NAME}}
          })),

        select{{ITEM_NAME}}: ({{ITEM_NAME}}) =>
          set({ {{SELECTED_NAME}}: {{ITEM_NAME}} }),

        setLoading: (loading) =>
          set({ {{LOADING_NAME}}: loading }),

        setError: (error) =>
          set({ {{ERROR_NAME}}: error }),

        clear: () =>
          set({
            {{DATA_NAME}}: [],
            {{LOADING_NAME}}: false,
            {{ERROR_NAME}}: null,
            {{SELECTED_NAME}}: null
          })
      }),
      {
        name: '{{STORE_NAME_LOWER}}-store',
        partialize: (state) => ({
          // Only persist data, not loading/error states
          {{DATA_NAME}}: state.{{DATA_NAME}}
        })
      }
    ),
    { name: '{{STORE_NAME}}Store' }
  )
)

// Selector hooks for better performance
export const use{{DATA_NAME}} = () => use{{STORE_NAME}}Store((state) => state.{{DATA_NAME}})
export const use{{SELECTED_NAME}} = () => use{{STORE_NAME}}Store((state) => state.{{SELECTED_NAME}})
export const use{{LOADING_NAME}} = () => use{{STORE_NAME}}Store((state) => state.{{LOADING_NAME}})
export const use{{ERROR_NAME}} = () => use{{STORE_NAME}}Store((state) => state.{{ERROR_NAME}})
