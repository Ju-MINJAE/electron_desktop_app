export const IPC_CHANNELS = { ping: 'app:ping' } as const

export interface DesktopAPI {
  ping: () => Promise<'pong'>
  versions: { electron: string; chrome: string; node: string }
}
