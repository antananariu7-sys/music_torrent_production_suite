import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = resolve(__dirname, '..')

async function buildMain() {
  try {
    await esbuild.build({
      entryPoints: [resolve(rootDir, 'src/main/index.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: resolve(rootDir, 'dist/main/index.cjs'),
      external: [
        'electron',
        'electron-store',
        'puppeteer-core',
        'cheerio',
        'music-metadata',
        'webtorrent',
        'parse-torrent',
        'csv-stringify',
        'uuid'
      ],
      alias: {
        '@shared': resolve(rootDir, 'src/shared')
      },
      target: 'node25',
      sourcemap: process.env.NODE_ENV === 'development',
      minify: process.env.NODE_ENV === 'production',
    })
    console.log('✓ Main process bundled successfully')
  } catch (error) {
    console.error('✗ Failed to bundle main process:', error)
    process.exit(1)
  }
}

buildMain()
