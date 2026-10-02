import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type DesktopAPI } from '../shared-api'

const api: DesktopAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
}

contextBridge.exposeInMainWorld('api', api)
