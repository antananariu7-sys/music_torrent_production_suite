import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = resolve(__dirname, '..')

async function buildPreload() {
  try {
    await esbuild.build({
      entryPoints: [resolve(rootDir, 'src/preload/index.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: resolve(rootDir, 'dist/preload/index.cjs'),
      external: ['electron'],
      sourcemap: process.env.NODE_ENV === 'development',
      minify: process.env.NODE_ENV === 'production',
    })
    console.log('✓ Preload script bundled successfully')
  } catch (error) {
    console.error('✗ Failed to bundle preload script:', error)
    process.exit(1)
  }
}

buildPreload()
