import type { TorrentContentFile } from '@shared/types/torrent.types'

export interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  files: TorrentContentFile[] // Files in this folder (for progress calculation)
  size: number
  downloaded: number
  progress: number
  selected: boolean // Whether this file/folder is selected for download
}

export function buildFileTree(files: TorrentContentFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: [],
    files: [],
    size: 0,
    downloaded: 0,
    progress: 0,
    selected: true,
  }

  files.forEach((file) => {
    const parts = file.path.split(/[\\/]/).filter(Boolean)
    let currentNode = root

    // Navigate/create folder structure
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
          files: [],
          size: 0,
          downloaded: 0,
          progress: 0,
          selected: true,
        }
        currentNode.children.push(folderNode)
      }

      currentNode = folderNode
    }

    // Add file to current folder
    const fileName = parts[parts.length - 1]
    currentNode.children.push({
      name: fileName,
      path: file.path,
      isFolder: false,
      children: [],
      files: [file],
      size: file.size,
      downloaded: file.downloaded,
      progress: file.progress,
      selected: file.selected,
    })
  })

  // Calculate folder sizes and progress recursively
  function calculateFolderData(node: TreeNode): void {
    if (!node.isFolder) return

    node.files = []
    node.size = 0
    node.downloaded = 0

    for (const child of node.children) {
      calculateFolderData(child)
      node.files.push(...child.files)
      node.size += child.size
      node.downloaded += child.downloaded
    }

    node.progress = node.size > 0 ? Math.round((node.downloaded / node.size) * 100) : 0
    // Folder is selected if at least one child is selected
    node.selected = node.children.some(child => child.selected)
  }

  calculateFolderData(root)

  // Sort children: folders first, then files, both alphabetically
  function sortChildren(node: TreeNode): void {
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
