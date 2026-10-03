const assert = require('node:assert/strict')
const { app } = require('electron')

const timeout = setTimeout(() => {
  console.error('Electron smoke test timed out')
  app.exit(1)
}, 30000)

app.on('browser-window-created', (_, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const preferences = window.webContents.getLastWebPreferences()
      assert.equal(preferences.sandbox, true)
      assert.equal(preferences.contextIsolation, true)
      assert.equal(preferences.nodeIntegration, false)
      const result = await window.webContents.executeJavaScript(`
        (async () => ({
          reply: await window.api.ping(),
          invalidRemote: await window.api.connectRDP({ ip: '127.0.0.1;echo', port: 3389 }),
          invalidWake: await window.api.wakePC({ ip: 'invalid' }),
          invalidShutdown: await window.api.shutdownPC({ ip: 'invalid' }),
          electron: window.api.versions.electron,
          genericAPI: typeof window.electron,
          requireType: typeof require,
          title: document.title,
          mounted: document.querySelector('#root').children.length > 0
        }))()
      `)
      assert.equal(result.reply, 'pong')
      assert.equal(result.invalidRemote.ok, false)
      assert.equal(result.invalidWake.ok, false)
      assert.equal(result.invalidShutdown.ok, false)
      assert.equal(result.electron, process.versions.electron)
      assert.equal(result.genericAPI, 'undefined')
      assert.equal(result.requireType, 'undefined')
      assert.equal(result.title, 'TotalControlPro')
      assert.equal(result.mounted, true)
      console.info('Electron smoke test passed: sandbox, preload, IPC, renderer')
      clearTimeout(timeout)
      app.exit(0)
    } catch (error) {
      console.error(error)
      clearTimeout(timeout)
      app.exit(1)
    }
  })
})

require('../out/main/index.js')
