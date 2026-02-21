/**
 * Generate .ico, .png icons from the master SVG.
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: sharp (dev dependency)
 * Outputs:  build/icon.ico, build/icon.png (256x256), build/icons/*.png
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '..')

const SVG_PATH = resolve(root, 'assets/icon.svg')
const BUILD_DIR = resolve(root, 'build')
const ICONS_DIR = resolve(BUILD_DIR, 'icons')

// ICO sizes: 16, 24, 32, 48, 64, 128, 256
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
// Extra PNG sizes for Linux / electron-builder
const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024]

async function svgToPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: Math.round((72 * size) / 512) * 4 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

/**
 * Build a multi-resolution .ico file from PNG buffers.
 * ICO format: ICONDIR + ICONDIRENTRY[] + image data (PNG payloads).
 */
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length

  // ICONDIR: 6 bytes
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = ICO
  header.writeUInt16LE(count, 4)

  // ICONDIRENTRY: 16 bytes each
  const entries = Buffer.alloc(count * 16)
  let dataOffset = 6 + count * 16

  for (let i = 0; i < count; i++) {
    const size = sizes[i]
    const png = pngBuffers[i]
    const off = i * 16

    entries.writeUInt8(size >= 256 ? 0 : size, off + 0)  // width (0 = 256)
    entries.writeUInt8(size >= 256 ? 0 : size, off + 1)  // height
    entries.writeUInt8(0, off + 2)   // color palette
    entries.writeUInt8(0, off + 3)   // reserved
    entries.writeUInt16LE(1, off + 4)  // color planes
    entries.writeUInt16LE(32, off + 6) // bits per pixel
    entries.writeUInt32LE(png.length, off + 8)  // image size
    entries.writeUInt32LE(dataOffset, off + 12) // offset to data

    dataOffset += png.length
  }

  return Buffer.concat([header, entries, ...pngBuffers])
}

async function main() {
  console.log('Reading SVG from', SVG_PATH)
  const svgBuffer = readFileSync(SVG_PATH)

  mkdirSync(BUILD_DIR, { recursive: true })
  mkdirSync(ICONS_DIR, { recursive: true })

  // Generate PNGs for ICO
  console.log('Generating ICO sizes:', ICO_SIZES.join(', '))
  const icoPngs = await Promise.all(ICO_SIZES.map((s) => svgToPng(svgBuffer, s)))

  // Build and write ICO
  const ico = buildIco(icoPngs, ICO_SIZES)
  const icoPath = resolve(BUILD_DIR, 'icon.ico')
  writeFileSync(icoPath, ico)
  console.log('Wrote', icoPath, `(${ico.length} bytes)`)

  // Generate all PNG sizes
  console.log('Generating PNG sizes:', PNG_SIZES.join(', '))
  for (const size of PNG_SIZES) {
    const png = await svgToPng(svgBuffer, size)
    const pngPath = resolve(ICONS_DIR, `${size}x${size}.png`)
    writeFileSync(pngPath, png)
    console.log('Wrote', pngPath)
  }

  // Main icon.png (256x256) for electron-builder
  const mainPng = await svgToPng(svgBuffer, 256)
  writeFileSync(resolve(BUILD_DIR, 'icon.png'), mainPng)
  console.log('Wrote', resolve(BUILD_DIR, 'icon.png'))

  // Favicon for renderer (32x32) — goes in Vite public dir
  const favicon = await svgToPng(svgBuffer, 32)
  const publicDir = resolve(root, 'src/renderer/public')
  mkdirSync(publicDir, { recursive: true })
  writeFileSync(resolve(publicDir, 'favicon.png'), favicon)
  console.log('Wrote src/renderer/public/favicon.png')

  console.log('\nDone! Icon files generated successfully.')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
