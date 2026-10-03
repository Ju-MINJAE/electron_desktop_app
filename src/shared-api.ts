export const IPC_CHANNELS = {
  ping: 'app:ping',
  connectRDP: 'remote:connect-rdp',
  wakePC: 'remote:wake',
  shutdownPC: 'remote:shutdown',
  probeRDP: 'remote:probe'
} as const

export interface RemoteTarget {
  ip: string
  port: number
}
export interface RemoteResult {
  ok: boolean
  message: string
}

export interface PowerTarget {
  ip: string
  mac: string
  broadcast: string
  shutdownMethod: 'windows' | 'ssh'
  sshUser: string
  sshPort: number
}
export interface DesktopAPI {
  wakePC: (target: PowerTarget) => Promise<RemoteResult>
  shutdownPC: (target: PowerTarget) => Promise<RemoteResult>
  probeRDP: (target: RemoteTarget) => Promise<boolean>
  connectRDP: (target: RemoteTarget) => Promise<RemoteResult>
  ping: () => Promise<'pong'>
  versions: { electron: string; chrome: string; node: string }
}
