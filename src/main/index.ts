import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { IPC_CHANNELS } from '../shared-api'
import { connectRDP } from './remote'
import { wakePC, shutdownPC, probeRDP } from './power'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const rendererURL =
  is.dev && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL']
    : pathToFileURL(join(__dirname, '../renderer/index.html')).href

function isTrustedRenderer(url: string): boolean {
  try {
    const actual = new URL(url)
    const expected = new URL(rendererURL)
    actual.hash = ''
    expected.hash = ''
    return actual.href === expected.href
  } catch {
    return false
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    minWidth: 960,
    minHeight: 600,
    title: 'TotalControlPro',
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.origin === 'https://electron-vite.org' && !url.username && !url.password) {
        void shell.openExternal(url.href).catch(console.error)
      }
    } catch {
      // Ignore malformed URLs.
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.on('will-redirect', (event) => event.preventDefault())

  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('app.totalcontrolpro')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Only the application's top-level frame may invoke this argument-free API.
  ipcMain.handle(IPC_CHANNELS.ping, (event, ...args: unknown[]) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isTrustedRenderer(event.senderFrame.url) ||
      args.length !== 0
    ) {
      throw new Error('Invalid IPC request')
    }
    return 'pong'
  })

  ipcMain.handle(IPC_CHANNELS.connectRDP, async (event, ...args: unknown[]) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isTrustedRenderer(event.senderFrame.url) ||
      args.length !== 1
    ) {
      throw new Error('Invalid IPC request')
    }
    try {
      await connectRDP(args[0])
      return {
        ok: true,
        message: 'RDP 클라이언트를 열었습니다. 접속과 로그인은 클라이언트에서 확인하세요.'
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '원격 접속 실행에 실패했습니다.'
      }
    }
  })

  for (const [channel, operation, message] of [
    [IPC_CHANNELS.wakePC, wakePC, 'WOL 패킷을 전송했습니다. 실제 부팅 여부는 별도로 확인하세요.'],
    [
      IPC_CHANNELS.shutdownPC,
      shutdownPC,
      '종료 명령이 수락되었습니다. 실제 종료 여부는 별도로 확인하세요.'
    ]
  ] as const) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      if (
        !BrowserWindow.fromWebContents(event.sender) ||
        event.senderFrame !== event.sender.mainFrame ||
        !event.senderFrame ||
        !isTrustedRenderer(event.senderFrame.url) ||
        args.length !== 1
      )
        throw new Error('Invalid IPC request')
      try {
        await operation(args[0])
        return { ok: true, message }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : '전원 요청 실패' }
      }
    })
  }
  ipcMain.handle(IPC_CHANNELS.probeRDP, (event, ...args: unknown[]) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isTrustedRenderer(event.senderFrame.url) ||
      args.length !== 1
    )
      throw new Error('Invalid IPC request')
    return probeRDP(args[0])
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
