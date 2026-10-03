import { app, shell } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isIP } from 'node:net'
import { spawn } from 'node:child_process'
import type { RemoteTarget } from '../shared-api'

export function validateTarget(input: unknown): RemoteTarget {
  if (!input || typeof input !== 'object') throw new Error('잘못된 접속 정보입니다.')
  const { ip, port } = input as Partial<RemoteTarget>
  if (
    typeof ip !== 'string' ||
    isIP(ip) !== 4 ||
    !Number.isInteger(port) ||
    !port ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('IPv4 주소와 포트(1~65535)를 확인하세요.')
  }
  return { ip, port }
}

export async function connectRDP(input: unknown): Promise<void> {
  const { ip, port } = validateTarget(input)
  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('mstsc.exe', [`/v:${ip}:${port}`, '/prompt'], {
        detached: true,
        stdio: 'ignore',
        shell: false
      })
      child.once('error', () =>
        reject(new Error('Windows 원격 데스크톱 클라이언트를 실행할 수 없습니다.'))
      )
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
    })
    return
  }
  const directory = join(app.getPath('userData'), 'rdp')
  await mkdir(directory, { recursive: true })
  const file = join(directory, `${ip}-${port}.rdp`)
  await writeFile(
    file,
    `full address:s:${ip}:${port}\r\nprompt for credentials:i:1\r\nauthentication level:i:2\r\nredirectclipboard:i:0\r\n`,
    { mode: 0o600 }
  )
  const error = await shell.openPath(file)
  if (error)
    throw new Error(
      'RDP 파일을 열 수 없습니다. macOS는 Windows App, Linux는 RDP 클라이언트를 설치하고 .rdp 파일 연결을 설정하세요.'
    )
}
