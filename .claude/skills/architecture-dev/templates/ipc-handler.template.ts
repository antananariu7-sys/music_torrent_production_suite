// src/main/ipc/{{FEATURE_NAME}}-handlers.ts

import { ipcMain } from 'electron'
import { services } from '../services'
import { {{SCHEMA_NAME}}Schema } from '../../shared/schemas/{{FEATURE_NAME}}.schema'

/**
 * IPC Handlers for {{FEATURE_DESCRIPTION}}
 *
 * Channels:
 * - {{CHANNEL_PREFIX}}:{{ACTION_1}} - {{ACTION_1_DESCRIPTION}}
 * - {{CHANNEL_PREFIX}}:{{ACTION_2}} - {{ACTION_2_DESCRIPTION}}
 */

// Request-response pattern
ipcMain.handle('{{CHANNEL_PREFIX}}:{{ACTION_1}}', async (event, data) => {
  // Validate input with Zod
  const validated = {{SCHEMA_NAME}}Schema.parse(data)

  // Execute business logic via service
  const result = await services.{{SERVICE_NAME}}.{{METHOD_NAME}}(validated)

  return result
})

// Request with progress updates
ipcMain.handle('{{CHANNEL_PREFIX}}:{{ACTION_2}}', async (event, data) => {
  const validated = {{SCHEMA_NAME}}Schema.parse(data)

  // Send progress updates
  const onProgress = (progress: {{PROGRESS_TYPE}}) => {
    event.sender.send('{{CHANNEL_PREFIX}}:progress', progress)
  }

  try {
    const result = await services.{{SERVICE_NAME}}.{{METHOD_WITH_PROGRESS}}(
      validated,
      onProgress
    )

    // Send completion event
    event.sender.send('{{CHANNEL_PREFIX}}:complete', result)

    return result
  } catch (error) {
    // Send error event
    event.sender.send('{{CHANNEL_PREFIX}}:error', {
      message: error.message,
      code: error.code
    })
    throw error
  }
})

// Simple getter (no validation needed)
ipcMain.handle('{{CHANNEL_PREFIX}}:get', async () => {
  return await services.{{SERVICE_NAME}}.getAll()
})

// Delete handler
ipcMain.handle('{{CHANNEL_PREFIX}}:delete', async (event, id: string) => {
  await services.{{SERVICE_NAME}}.delete(id)
  return { success: true }
})
