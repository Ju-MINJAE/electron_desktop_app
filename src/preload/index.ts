import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type DesktopAPI } from '../shared-api'

const api: DesktopAPI = {
  wakePC: (target) => ipcRenderer.invoke(IPC_CHANNELS.wakePC, target),
  shutdownPC: (target) => ipcRenderer.invoke(IPC_CHANNELS.shutdownPC, target),
  probeRDP: (target) => ipcRenderer.invoke(IPC_CHANNELS.probeRDP, target),
  connectRDP: (target) => ipcRenderer.invoke(IPC_CHANNELS.connectRDP, target),
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
}

contextBridge.exposeInMainWorld('api', api)
