// src/renderer/components/features/{{FEATURE_NAME}}/{{COMPONENT_NAME}}.tsx

import { useState, useEffect, useCallback } from 'react'
import { use{{STORE_NAME}}Store } from '../../../store/use{{STORE_NAME}}Store'
import type { {{TYPE_NAME}} } from '../../../../shared/types/{{FEATURE_NAME}}.types'

/**
 * {{COMPONENT_DESCRIPTION}}
 *
 * Features:
 * - {{FEATURE_1}}
 * - {{FEATURE_2}}
 * - {{FEATURE_3}}
 */

interface {{COMPONENT_NAME}}Props {
  {{PROP_NAME_1}}: {{PROP_TYPE_1}}
  {{PROP_NAME_2}}?: {{PROP_TYPE_2}}
  on{{EVENT_NAME}}?: (data: {{EVENT_DATA_TYPE}}) => void
}

export function {{COMPONENT_NAME}}({
  {{PROP_NAME_1}},
  {{PROP_NAME_2}},
  on{{EVENT_NAME}}
}: {{COMPONENT_NAME}}Props) {
  // Local state
  const [{{STATE_NAME}}, set{{STATE_NAME}}] = useState<{{STATE_TYPE}}>({{DEFAULT_VALUE}})

  // Zustand store
  const {
    {{STORE_VALUE_1}},
    {{STORE_VALUE_2}},
    {{STORE_ACTION_1}},
    {{STORE_ACTION_2}}
  } = use{{STORE_NAME}}Store()

  // IPC communication
  useEffect(() => {
    // Subscribe to events
    const cleanup = window.api.on{{EVENT_NAME}}((data) => {
      {{STORE_ACTION_1}}(data)
    })

    return cleanup
  }, [{{STORE_ACTION_1}}])

  // Event handlers
  const handle{{ACTION_NAME}} = useCallback(async () => {
    try {
      const result = await window.api.{{API_METHOD}}({{PARAM}})
      {{STORE_ACTION_2}}(result)
      on{{EVENT_NAME}}?.(result)
    } catch (error) {
      console.error('Error:', error)
      // Handle error (show toast, etc.)
    }
  }, [{{DEPENDENCIES}}])

  // Render empty state
  if ({{EMPTY_CONDITION}}) {
    return (
      <div className="empty-state">
        <p>{{EMPTY_MESSAGE}}</p>
      </div>
    )
  }

  // Render loading state
  if ({{LOADING_CONDITION}}) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    )
  }

  // Main render
  return (
    <div className="{{COMPONENT_CLASS}}">
      <h2>{{COMPONENT_TITLE}}</h2>

      {/* Component content */}
      <div className="content">
        {{{STORE_VALUE_1}}.map((item) => (
          <div key={item.id} className="item">
            <span>{item.{{PROPERTY}}}</span>
            <button onClick={() => handle{{ACTION_NAME}}()}>
              {{BUTTON_LABEL}}
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="actions">
        <button onClick={handle{{ACTION_NAME}}}>
          {{ACTION_LABEL}}
        </button>
      </div>
    </div>
  )
}
