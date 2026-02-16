import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fsp } from 'node:fs'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

type WatcherFilters = {
  extensions: string[]
  ignoreHidden: boolean
}

let watcherFilters: WatcherFilters = {
  extensions: ['.pdf', '.doc', '.docx', '.txt'],
  ignoreHidden: true,
}

const SECURE_STORE_FILENAME = 'secure-store.json'

function getSecureStorePath() {
  return path.join(app.getPath('userData'), SECURE_STORE_FILENAME)
}

async function readSecureStore(): Promise<Record<string, string>> {
  try {
    const raw = await fsp.readFile(getSecureStorePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

async function writeSecureStore(store: Record<string, string>) {
  await fsp.writeFile(getSecureStorePath(), JSON.stringify(store), 'utf8')
}

function encryptIfAvailable(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return value
}

function decryptIfAvailable(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }
  return value
}

function shouldEmitFileEvent(filename: string): boolean {
  const normalized = filename.toLowerCase()

  if (watcherFilters.ignoreHidden) {
    const pathParts = normalized.split(/[\\/]/)
    if (pathParts.some(part => part.startsWith('.'))) {
      return false
    }
  }

  if (watcherFilters.extensions.length > 0) {
    const hasAllowedExtension = watcherFilters.extensions.some(ext => normalized.endsWith(ext))
    if (!hasAllowedExtension) {
      return false
    }
  }

  return true
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('secure-store-get', async (_event, key: string) => {
    const store = await readSecureStore()
    const value = store[key]
    if (!value) {
      return null
    }

    try {
      return decryptIfAvailable(value)
    } catch {
      return null
    }
  })

  ipcMain.handle('secure-store-set', async (_event, key: string, value: string) => {
    const store = await readSecureStore()
    store[key] = encryptIfAvailable(value)
    await writeSecureStore(store)
    return true
  })

  ipcMain.handle('secure-store-delete', async (_event, key: string) => {
    const store = await readSecureStore()
    delete store[key]
    await writeSecureStore(store)
    return true
  })

  ipcMain.handle('watcher-get-filters', async () => {
    return watcherFilters
  })

  ipcMain.handle('watcher-set-filters', async (_event, filters: Partial<WatcherFilters>) => {
    const parsedExtensions = Array.isArray(filters?.extensions)
      ? filters.extensions
        .map(ext => String(ext || '').trim().toLowerCase())
        .filter(Boolean)
        .map(ext => ext.startsWith('.') ? ext : `.${ext}`)
      : watcherFilters.extensions

    watcherFilters = {
      extensions: parsedExtensions,
      ignoreHidden: filters?.ignoreHidden ?? watcherFilters.ignoreHidden,
    }

    win?.webContents.send('watcher-status', {
      active: true,
      path: '',
      message: 'Watcher filters updated',
      filters: watcherFilters,
    })

    return watcherFilters
  })

  createWindow()

  // --- FILE WATCHER LOGIC ---
  const documentsPath = app.getPath('documents')
  const watchPath = path.join(documentsPath, 'Chamber.Law') // Specific folder? Or just Documents? 
  // Let's watch the whole documents folder but filter? No, that's too much noise. 
  // Let's create a specific folder if it doesn't exist.
  // Let's create a specific folder if it doesn't exist.

  // Note: We need to use dynamic import or ensure strict ESM if package.json has type: module
  // main.ts imports imply ESM.

  import('node:fs').then(fs => {
    if (!fs.existsSync(watchPath)) {
      try {
        fs.mkdirSync(watchPath, { recursive: true })
      } catch (e) {
        console.error("Failed to create watch directory", e)
      }
    }

    console.log(`Watching ${watchPath}`)

    // Send initial status
    setTimeout(() => {
      win?.webContents.send('watcher-status', {
        active: true,
        path: watchPath,
        message: 'Monitoring active',
        filters: watcherFilters,
      })
    }, 2000)

    try {
      fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          if (!shouldEmitFileEvent(filename)) {
            return
          }

          console.log(`File Change: ${eventType} ${filename}`)
          win?.webContents.send('file-change', { eventType, filename })
        }
      })
    } catch (err) {
      console.error("Watcher failed", err)
      win?.webContents.send('watcher-status', {
        active: false,
        path: watchPath,
        message: 'Watcher failed to start: ' + err
      })
    }
  })
})
