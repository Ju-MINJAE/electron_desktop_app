import { useEffect, useRef, useState } from 'react'
import type { PowerTarget } from '../../shared-api'
import { applyTheme, readTheme, saveTheme, type ThemePreference } from './theme'

interface PC extends PowerTarget {
  id: string
  name: string
  ip: string
  rdpPort: number
}
const storageKey = 'totalcontrolpro.pcs.v1'
const defaults: Omit<PC, 'id' | 'name' | 'ip'> = {
  mac: '',
  broadcast: '255.255.255.255',
  shutdownMethod: 'ssh',
  sshUser: '',
  sshPort: 22,
  rdpPort: 3389
}
const initialPCs: PC[] = []
function readPCs(): PC[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return initialPCs
    const data: unknown = JSON.parse(raw)
    if (
      Array.isArray(data) &&
      data.every(
        (p) =>
          p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.ip === 'string'
      ) &&
      new Set(data.map((p) => p.id)).size === data.length
    )
      return data.map((p) => ({
        ...defaults,
        ...p,
        rdpPort: Number.isInteger(p.rdpPort) ? p.rdpPort : 3389
      }))
  } catch {
    /* Restore defaults if saved data cannot be read. */
  }
  return initialPCs
}
function Monitor(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}
function App(): React.JSX.Element {
  const [theme, setTheme] = useState(readTheme)
  const [pcs, setPCs] = useState(readPCs)
  const [now, setNow] = useState(new Date())
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [ip, setIP] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(defaults)
  const [editing, setEditing] = useState<string | null>(null)
  const [requests, setRequests] = useState<Record<string, string>>({})
  const [connections, setConnections] = useState<Record<string, boolean>>({})
  const busyRef = useRef(new Set<string>())
  const [busy, setBusy] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState<{ text: string; run: () => void } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  function notify(text: string): void {
    setMessage(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setMessage(''), 2500)
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(timer)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pcs))
    } catch {
      const timer = setTimeout(
        () => setMessage('PC 목록을 저장할 수 없습니다. 저장 공간을 확인하세요.'),
        0
      )
      return () => clearTimeout(timer)
    }
    return undefined
  }, [pcs])
  useEffect(() => {
    if (!adding && !confirmation) return
    const previous = document.activeElement as HTMLElement | null
    modalRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    function keydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setAdding(false)
        setConfirmation(null)
      }
      if (event.key !== 'Tab') return
      const elements = modalRef.current?.querySelectorAll<HTMLElement>('input, button')
      if (!elements?.length) return
      const first = elements[0],
        last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [adding, confirmation])
  useEffect(() => {
    applyTheme(theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => {
      if (theme === 'system') applyTheme(theme)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])
  function changeTheme(value: ThemePreference): void {
    setTheme(value)
    try {
      saveTheme(value)
    } catch {
      notify('테마를 저장할 수 없습니다. 이번 실행에만 적용합니다.')
    }
  }
  async function openRemote(pc: PC): Promise<void> {
    try {
      const result = await window.api.connectRDP({ ip: pc.ip, port: pc.rdpPort })
      notify(result.message)
    } catch {
      notify('원격 접속 요청에 실패했습니다.')
    }
  }
  useEffect(() => {
    let cancelled = false
    async function check(): Promise<void> {
      for (const pc of pcs) {
        if (cancelled) return
        try {
          const reachable = await window.api.probeRDP({ ip: pc.ip, port: pc.rdpPort })
          if (!cancelled) setConnections((current) => ({ ...current, [pc.id]: reachable }))
        } catch {
          if (!cancelled) setConnections((current) => ({ ...current, [pc.id]: false }))
        }
      }
      if (!cancelled) timer = setTimeout(() => void check(), 10000)
    }
    let timer: ReturnType<typeof setTimeout>
    void check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pcs])
  async function power(id: string | null, value: boolean): Promise<void> {
    for (const pc of pcs.filter((p) => id === null || p.id === id)) {
      if (busyRef.current.has(pc.id)) continue
      busyRef.current.add(pc.id)
      setBusy([...busyRef.current])
      setRequests((current) => ({ ...current, [pc.id]: '요청 중' }))
      try {
        const result = await (value ? window.api.wakePC(pc) : window.api.shutdownPC(pc))
        setRequests((current) => ({
          ...current,
          [pc.id]: result.ok ? (value ? 'WOL 전송됨' : '종료 요청됨') : '요청 실패'
        }))
        notify(`${pc.name}: ${result.message}`)
      } catch {
        setRequests((current) => ({ ...current, [pc.id]: '요청 실패' }))
        notify(`${pc.name}: 전원 요청 실패`)
      } finally {
        busyRef.current.delete(pc.id)
        setBusy([...busyRef.current])
      }
    }
  }
  function configure(pc?: PC): void {
    setEditing(pc?.id ?? null)
    setName(pc?.name ?? '')
    setIP(pc?.ip ?? '')
    setSettings(
      pc
        ? {
            mac: pc.mac,
            broadcast: pc.broadcast,
            shutdownMethod: pc.shutdownMethod,
            sshUser: pc.sshUser,
            sshPort: pc.sshPort,
            rdpPort: pc.rdpPort
          }
        : defaults
    )
    setError('')
    setAdding(true)
  }
  function addPC(event: React.FormEvent): void {
    event.preventDefault()
    const address = ip.trim()
    if (!name.trim() || name.trim().length > 80) {
      setError('명칭을 1~80자로 입력하세요.')
      return
    }
    if (
      !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(address) ||
      address.split('.').some((n) => Number(n) > 255)
    ) {
      setError('올바른 IPv4 주소를 입력하세요.')
      return
    }
    if (pcs.some((p) => p.ip === address && p.id !== editing)) {
      setError('이미 등록된 IP 주소입니다.')
      return
    }
    if (settings.mac && !/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(settings.mac)) {
      setError('MAC 주소 형식을 확인하세요.')
      return
    }
    if (
      !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(settings.broadcast) ||
      settings.broadcast.split('.').some((n) => Number(n) > 255)
    ) {
      setError('브로드캐스트 IPv4 주소를 확인하세요.')
      return
    }
    if (
      ![settings.rdpPort, settings.sshPort].every(
        (port) => Number.isInteger(port) && port >= 1 && port <= 65535
      )
    ) {
      setError('포트는 1~65535 범위여야 합니다.')
      return
    }
    if (settings.sshUser && !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/.test(settings.sshUser)) {
      setError('SSH 사용자 이름을 확인하세요.')
      return
    }
    const pc: PC = {
      ...settings,
      id: editing ?? crypto.randomUUID(),
      name: name.trim(),
      ip: address
    }
    setPCs((items) =>
      editing ? items.map((item) => (item.id === editing ? pc : item)) : [...items, pc]
    )
    setAdding(false)
    notify(editing ? 'PC 설정을 저장했습니다' : 'PC를 등록했습니다')
  }
  return (
    <div className="app">
      <nav aria-label="메인 메뉴">
        <div className="brand">
          TotalControl<small>Pro V1</small>
        </div>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault()
            notify('이 메뉴는 준비 중입니다')
          }}
        >
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
          <span>스케줄</span>
        </a>
        <a href="#" onClick={(event) => event.preventDefault()} className="on" aria-current="page">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
          <span>PC 설정</span>
        </a>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault()
            notify('이 메뉴는 준비 중입니다')
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M3 8h18v8H3zM7 8V5h10v3M8 16v3M16 16v3" />
          </svg>
          <span>프로젝터</span>
        </a>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault()
            notify('이 메뉴는 준비 중입니다')
          }}
        >
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m10 9 5 3-5 3z" />
          </svg>
          <span>동영상</span>
        </a>
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault()
            notify('이 메뉴는 준비 중입니다')
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
          <span>원격전원(PDU)</span>
        </a>
      </nav>
      <main>
        <header>
          <h1>PC 설정</h1>
          <div className="hr">
            <label className="theme-picker">
              테마
              <select
                value={theme}
                onChange={(event) => changeTheme(event.target.value as ThemePreference)}
              >
                <option value="system">시스템</option>
                <option value="light">라이트</option>
                <option value="dark">다크</option>
              </select>
            </label>
            <span id="clock">
              {now.toLocaleDateString('sv-SE')} {now.toLocaleTimeString('en-GB')}
            </span>
            <button
              className="ghost"
              onClick={() => notify('관리자 인증은 아직 연동되지 않았습니다')}
            >
              관리자 진입
            </button>
          </div>
        </header>

        <section className="list" aria-label="등록된 PC">
          <div className="head">
            <span>등록 명칭 / IP</span>
            <span>원격 화면</span>
            <span>전원 스위치</span>
            <span>전원 요청</span>
            <span>통신 상태</span>
            <span />
          </div>
          <div id="rows">
            {pcs.map((pc) => (
              <div className="item" key={pc.id}>
                <div className="name">
                  <div className="ico">
                    <Monitor />
                  </div>
                  <div>
                    <button
                      className="pc-edit"
                      onClick={() => configure(pc)}
                      title="장치 설정 수정"
                    >
                      {pc.name}
                    </button>
                    <span className="ip">{pc.ip}</span>
                  </div>
                </div>
                <button className="rdp" onClick={() => void openRemote(pc)}>
                  RDP 접속
                </button>
                <div className="seg" role="group" aria-label={`${pc.name} 전원`}>
                  <button disabled={busy.includes(pc.id)} onClick={() => void power(pc.id, true)}>
                    ON
                  </button>
                  <button
                    disabled={busy.includes(pc.id)}
                    onClick={() =>
                      setConfirmation({
                        text: `${pc.name}을 종료할까요? 저장하지 않은 작업을 확인하세요.`,
                        run: () => {
                          void power(pc.id, false)
                        }
                      })
                    }
                  >
                    OFF
                  </button>
                </div>
                <span className="pill p-wait">{requests[pc.id] ?? '요청 없음'}</span>
                <span className={`pill ${connections[pc.id] ? 'p-on' : 'p-wait'}`}>
                  <i className="dot" />
                  {connections[pc.id] === undefined
                    ? '확인 중'
                    : connections[pc.id]
                      ? 'RDP 응답'
                      : 'RDP 미응답'}
                </span>
                <button
                  className="del"
                  aria-label={`${pc.name} 삭제`}
                  onClick={() =>
                    setConfirmation({
                      text: `${pc.name} 항목을 삭제할까요?`,
                      run: () => {
                        setPCs((items) => items.filter((p) => p.id !== pc.id))
                        notify('삭제했습니다')
                      }
                    })
                  }
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            ))}
            {pcs.length === 0 && (
              <p className="empty">등록된 PC가 없습니다. 아래에서 항목을 추가하세요.</p>
            )}
          </div>
        </section>
        <footer>
          <div>
            <button className="btn b-sec" onClick={() => configure()}>
              + 신규 항목 추가
            </button>
            <button
              className="btn b-pri"
              onClick={() => notify('허브 탐색은 장치 프로토콜 연동 후 사용할 수 있습니다')}
            >
              허브 장치 자동 탐색
            </button>
          </div>
          <div>
            <button
              className="btn b-on"
              disabled={!pcs.length || busy.length > 0}
              onClick={() => void power(null, true)}
            >
              전체 일괄 켜기
            </button>
            <button
              className="btn b-off"
              disabled={!pcs.length || busy.length > 0}
              onClick={() =>
                setConfirmation({
                  text: '등록된 모든 PC를 종료할까요? 저장하지 않은 작업을 확인하세요.',
                  run: () => {
                    void power(null, false)
                  }
                })
              }
            >
              전체 일괄 끄기
            </button>
          </div>
        </footer>
      </main>
      <div id="toast" role="status" className={message ? 'show' : ''}>
        {message}
      </div>
      {(adding || confirmation) && (
        <div className="modal-backdrop">
          <div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <h2 id="dialog-title">{adding ? (editing ? 'PC 설정 수정' : 'PC 등록') : '확인'}</h2>
            {adding ? (
              <form onSubmit={addPC}>
                <label>
                  등록 명칭
                  <input
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  IPv4 주소
                  <input
                    value={ip}
                    placeholder="192.168.1.20"
                    onChange={(e) => setIP(e.target.value)}
                    required
                  />
                </label>
                <label>
                  RDP 포트
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={settings.rdpPort}
                    onChange={(e) => setSettings({ ...settings, rdpPort: Number(e.target.value) })}
                    required
                  />
                </label>
                <label>
                  MAC 주소 (WOL 켜기에 필요)
                  <input
                    value={settings.mac}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    onChange={(e) => setSettings({ ...settings, mac: e.target.value.trim() })}
                  />
                </label>
                <label>
                  WOL 브로드캐스트 주소
                  <input
                    value={settings.broadcast}
                    placeholder="192.168.1.255"
                    onChange={(e) => setSettings({ ...settings, broadcast: e.target.value.trim() })}
                    required
                  />
                </label>
                <label>
                  종료 방식
                  <select
                    value={settings.shutdownMethod}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        shutdownMethod: e.target.value as PowerTarget['shutdownMethod']
                      })
                    }
                  >
                    <option value="ssh">SSH (Windows OpenSSH 필요)</option>
                    <option value="windows">Windows 원격 종료 (앱도 Windows에서 실행)</option>
                  </select>
                </label>
                {settings.shutdownMethod === 'ssh' && (
                  <>
                    <label>
                      Windows SSH 사용자
                      <input
                        value={settings.sshUser}
                        onChange={(e) =>
                          setSettings({ ...settings, sshUser: e.target.value.trim() })
                        }
                      />
                    </label>
                    <label>
                      SSH 포트
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={settings.sshPort}
                        onChange={(e) =>
                          setSettings({ ...settings, sshPort: Number(e.target.value) })
                        }
                        required
                      />
                    </label>
                    <p className="help">
                      SSH 키 인증과 호스트 키 확인을 먼저 완료하세요. 비밀번호는 앱에 저장하지
                      않습니다.
                    </p>
                  </>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn b-sec" onClick={() => setAdding(false)}>
                    취소
                  </button>
                  <button className="btn b-pri" type="submit">
                    {editing ? '저장' : '등록'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>{confirmation?.text}</p>
                <div className="modal-actions">
                  <button className="btn b-sec" onClick={() => setConfirmation(null)}>
                    취소
                  </button>
                  <button
                    className="btn b-pri"
                    onClick={() => {
                      confirmation?.run()
                      setConfirmation(null)
                    }}
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default App
