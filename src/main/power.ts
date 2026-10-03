import { createSocket } from 'node:dgram'
import { createConnection, isIP } from 'node:net'
import { execFile } from 'node:child_process'
import type { PowerTarget, RemoteTarget } from '../shared-api'
import { validateTarget } from './remote'

export function magicPacket(mac: unknown): Buffer {
  if (typeof mac !== 'string' || !/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(mac))
    throw new Error('올바른 MAC 주소가 필요합니다.')
  const address = Buffer.from(mac.replace(/[:-]/g, ''), 'hex')
  if (address.every((byte) => byte === 0) || address[0] & 1)
    throw new Error('개별 장치의 MAC 주소를 입력하세요.')
  return Buffer.concat([Buffer.alloc(6, 255), ...Array.from({ length: 16 }, () => address)])
}
export async function wakePC(input: unknown): Promise<void> {
  if (!input || typeof input !== 'object') throw new Error('장치 정보가 필요합니다.')
  const target = input as PowerTarget
  validateTarget({ ip: target.ip, port: 9 })
  const packet = magicPacket(target.mac)
  if (typeof target.broadcast !== 'string' || isIP(target.broadcast) !== 4)
    throw new Error('WOL 브로드캐스트 IPv4 주소를 입력하세요.')
  await new Promise<void>((resolve, reject) => {
    const socket = createSocket('udp4')
    let finished = false
    const finish = (error?: Error): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      socket.close()
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => finish(new Error('WOL 전송 시간이 초과되었습니다.')), 3000)
    socket.on('error', finish)
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true)
        socket.send(packet, 9, target.broadcast, (error) => finish(error ?? undefined))
      } catch (error) {
        finish(error instanceof Error ? error : new Error('WOL 전송 실패'))
      }
    })
  })
}
export async function shutdownPC(input: unknown): Promise<void> {
  if (!input || typeof input !== 'object') throw new Error('장치 정보가 필요합니다.')
  const target = input as PowerTarget
  validateTarget({ ip: target.ip, port: 9 })
  let command: string
  let args: string[]
  if (target.shutdownMethod === 'windows') {
    if (process.platform !== 'win32')
      throw new Error(
        'Windows 원격 종료는 Windows에서 앱을 실행해야 합니다. macOS에서는 SSH 방식을 선택하세요.'
      )
    command = 'shutdown.exe'
    args = ['/s', '/m', `\\\\${target.ip}`, '/t', '0']
  } else if (target.shutdownMethod === 'ssh') {
    validateTarget({ ip: target.ip, port: target.sshPort })
    if (
      typeof target.sshUser !== 'string' ||
      !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/.test(target.sshUser)
    )
      throw new Error('SSH 사용자 이름을 확인하세요.')
    command = 'ssh'
    args = [
      '-T',
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=yes',
      '-o',
      'ConnectTimeout=8',
      '-p',
      String(target.sshPort),
      '-l',
      target.sshUser,
      target.ip,
      'shutdown.exe /s /t 0'
    ]
  } else throw new Error('종료 방식을 선택하세요.')
  await new Promise<void>((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: 12000, maxBuffer: 8192, windowsHide: true },
      (error, _stdout, stderr) => {
        if (error)
          reject(
            new Error(
              `종료 요청 실패: ${stderr.trim().slice(0, 400) || error.message}. 대상 PC의 권한·방화벽·SSH 키 설정을 확인하세요.`
            )
          )
        else resolve()
      }
    )
  })
}
export async function probeRDP(input: unknown): Promise<boolean> {
  const target: RemoteTarget = validateTarget(input)
  return new Promise((resolve) => {
    const socket = createConnection({ host: target.ip, port: target.port })
    const finish = (online: boolean): void => {
      socket.destroy()
      resolve(online)
    }
    socket.setTimeout(2000)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}
