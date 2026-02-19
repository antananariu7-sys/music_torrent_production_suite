import type { TorrentContentFile } from '@shared/types/torrent.types'

/**
 * Tree node for file/folder structure used in FileSelectionDialog
 */
export interface SelectionTreeNode {
  name: string
  path: string
  isFolder: boolean
  children: SelectionTreeNode[]
  fileIndices: number[] // indices into the original files array (recursively for folders)
  size: number // total size (for folders: sum of children)
}

/**
 * Format bytes to human-readable size string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Build a folder tree from a flat file list.
 * Folders first, alphabetical sort. Computes cumulative file indices and sizes.
 */
export function buildSelectionFileTree(files: TorrentContentFile[]): SelectionTreeNode {
  const root: SelectionTreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: [],
    fileIndices: [],
    size: 0,
  }

  files.forEach((file, index) => {
    const parts = file.path.split(/[\\/]/).filter(Boolean)
    let currentNode = root

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      let folderNode = currentNode.children.find(
        (child) => child.isFolder && child.name === folderName
      )

      if (!folderNode) {
        folderNode = {
          name: folderName,
          path: parts.slice(0, i + 1).join('/'),
          isFolder: true,
          children: [],
          fileIndices: [],
          size: 0,
        }
        currentNode.children.push(folderNode)
      }

      currentNode = folderNode
    }

    const fileName = parts[parts.length - 1]
    currentNode.children.push({
      name: fileName,
      path: file.path,
      isFolder: false,
      children: [],
      fileIndices: [index],
      size: file.size,
    })
  })

  function calculateFolderData(node: SelectionTreeNode): void {
    if (!node.isFolder) return

    node.fileIndices = []
    node.size = 0

    for (const child of node.children) {
      calculateFolderData(child)
      node.fileIndices.push(...child.fileIndices)
      node.size += child.size
    }
  }

  calculateFolderData(root)

  function sortChildren(node: SelectionTreeNode): void {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortChildren)
  }

  sortChildren(root)

  return root
}
