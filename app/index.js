const path = require('path')
const { app, BrowserWindow, Menu } = require('electron')
const debug = require('debug')('devdocs-desktop:index')
const createMenu = require('./menu')
const config = require('./config')
const tray = require('./tray')
const updater = require('./updater')
const { toggleGlobalShortcut } = require('./utils')
const login = require('./login')

require('electron-debug')()
require('electron-context-menu')({
  showInspectElement: true
})

app.setAppUserModelId('com.egoistian.devdocs')

let mainWindow
let isQuitting = false
let urlToOpen

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }

      mainWindow.show()
    }
  })
  app.on('ready', () => {
    const shortcut = config.get('shortcut')
    for (const name in shortcut) {
      const accelerator = shortcut[name]
      if (accelerator) {
        toggleGlobalShortcut({
          name,
          accelerator,
          registered: false,
          action: toggleWindow
        })
      }
    }

    // Browser menu bar
    Menu.setApplicationMenu(
      createMenu({
        toggleWindow
      })
    )
    Menu.setApplicationMenu(null)
    mainWindow = createMainWindow()
    tray.create(mainWindow)
    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
      updater.init()
      if (urlToOpen) {
        mainWindow.webContents.send('link', urlToOpen)
      }
    })
  })
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
  }
}

function createMainWindow() {
  const lastWindowState = config.get('lastWindowState')

  const win = new BrowserWindow({
    title: app.getName(),
    x: lastWindowState.x,
    y: lastWindowState.y,
    width: lastWindowState.width,
    height: lastWindowState.height,
    minWidth: 600,
    minHeight: 400,
    show: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff'
  })

  if (process.platform === 'darwin') {
    win.setSheetOffset(24)
  }

  const url = `file://${path.join(__dirname, 'renderer', 'index.html')}`

  win.loadURL(url)

  win.on('close', e => {
    if (!isQuitting) {
      e.preventDefault()

      if (process.platform === 'darwin') {
        app.hide()
      } else {
        win.hide()
      }
    }
  })

  return win
}

app.on('login', (event, webContents, request, authInfo, cb) => {
  debug('app.on(login)')
  event.preventDefault()
  login(cb)
})

app.on('ready', () => {
  const shortcut = config.get('shortcut')
  for (const name in shortcut) {
    const accelerator = shortcut[name]
    if (accelerator) {
      toggleGlobalShortcut({
        name,
        accelerator,
        registered: false,
        action: toggleWindow
      })
    }
  }

  Menu.setApplicationMenu(
    createMenu({
      toggleWindow
    })
  )
  mainWindow = createMainWindow()
  tray.create(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    updater.init()
    if (urlToOpen) {
      mainWindow.webContents.send('link', urlToOpen)
    }
  })
})

app.on('activate', () => {
  mainWindow.show()
})

// I have no idea what I'm doing here
// It just works...
let hasOpenedOnce
app.on('browser-window-focus', () => {
  if (hasOpenedOnce) {
    mainWindow.webContents.send('focus-webview')
  } else {
    hasOpenedOnce = true
  }
})

app.on('before-quit', () => {
  isQuitting = true

  if (!mainWindow.isFullScreen()) {
    config.set('lastWindowState', mainWindow.getBounds())
  }
})

app.setAsDefaultProtocolClient('devdocs')

app.on('will-finish-launching', () => {
  app.on('open-url', (e, url) => {
    if (mainWindow) {
      mainWindow.webContents.send('link', url)
    } else {
      urlToOpen = url
    }
  })
})
