# TotalControlPro

React, TypeScript, Electron 기반 데스크톱 앱입니다.

## 개발 환경

- Node.js 24.13.0 (`.node-version`), pnpm 10.28.1
- `pnpm install --frozen-lockfile`
- `pnpm dev`: 개발 서버 및 Electron 실행
- `pnpm check`: 포맷, ESLint, main/renderer 타입 검사
- `pnpm test:smoke`: 빌드 후 실제 Electron에서 sandbox, preload, IPC, React 마운트 검사

## 구조와 보안

- `src/main`: 창 관리, OS 접근, IPC 처리
- `src/preload`: renderer에 필요한 기능만 `window.api`로 노출
- `src/shared-api.ts`: IPC 채널 및 공유 타입
- `src/renderer`: React UI

sandbox와 context isolation을 활성화하고 Node integration은 비활성화합니다.
preload 의존성은 번들에 포함합니다. 새 IPC 기능을 추가할 때 main에서 발신 프레임과
입력값을 검증하세요. 외부 링크는 현재 문서 사이트 `https://electron-vite.org`만
허용하며 앱 내부 페이지 이동은 차단합니다. 허용 사이트는 main에서 명시적으로 관리합니다.
환경 파일은 Git에서 제외됩니다. renderer에 포함되는 값은 비밀로 취급할 수 없습니다.

## 빌드

- `pnpm build`: 타입 검사 및 번들 생성
- `pnpm build:unpack`: 설치 파일 없이 패키징
- `pnpm build:win`: Windows 설치 파일
- `pnpm build:mac`: macOS 패키지
- `pnpm build:linux`: Linux 패키지

대상 OS 환경에서 패키징과 실행을 확인하세요. 빌드 명령은 자동 게시하지 않습니다.
앱 ID는 `app.totalcontrolpro`이며 변경 시 `electron-builder.yml`과
`src/main/index.ts`를 함께 수정하세요.

배포 전 실제 작성자·홈페이지·브랜드 아이콘을 확정하고, 대상 OS의 코드 서명과
macOS 공증을 구성하세요. 현재 아이콘과 시작 화면은 템플릿이며 자동 업데이트는
구현하지 않았습니다. Linux deb 배포 시 실제 maintainer 정보도 필요합니다.

## PC 설정 첫 버전

`doc/`의 HTML 시안을 React 화면으로 옮겼습니다. PC 등록(명칭/IPv4), 중복 IP 검사,
삭제 확인, 빈 목록 안내와 로컬 저장을 지원합니다. 등록 목록은 같은 앱 환경에서 다시
실행해도 유지됩니다. 개발 환경과 패키징된 앱은 저장 영역이 다를 수 있습니다.

## 원격 접속 및 전원 제어

장치 등록 시 IPv4, RDP 포트, MAC 주소, WOL 브로드캐스트 주소, 종료 방식을 입력합니다.
기존 항목은 장치 명칭을 눌러 수정합니다. 새 설치에는 예시 장치를 자동 등록하지 않습니다.
기존 목록은 유지하며 부족한 연결 설정은 수정해야 합니다.

- RDP: Windows에서는 mstsc, macOS/Linux에서는 `.rdp` 파일에 연결된 클라이언트를 실행합니다.
  macOS에서는 Windows App을 설치하고 파일 연결을 설정하세요. RDP 대상은 Windows Pro/Enterprise 등
  원격 데스크톱 호스트 지원 에디션이어야 하며 RDP 활성화와 방화벽 설정이 필요합니다.
- ON: 입력한 MAC의 WOL 매직 패킷을 UDP 9번 포트로 보냅니다. BIOS/UEFI, 유선 NIC의
  Wake-on-LAN을 활성화하고 대상 서브넷의 브로드캐스트 주소를 입력하세요(예: /24에서
  `192.168.1.255`). 완전 종료 후 부팅은 하드웨어 및 빠른 시작 설정에 따라 지원이 다릅니다.
  다른 서브넷에는 라우터의 WOL 전달 설정이 필요할 수 있습니다.
- OFF / Windows 원격 종료: 앱도 Windows에서 실행해야 합니다. 현재 Windows 로그인 계정이
  대상 PC의 원격 종료 권한을 가지고 있어야 하며 관련 RPC 방화벽과 정책 설정이 필요합니다.
- OFF / SSH: macOS에서도 사용 가능합니다. 대상 Windows 10/11에 Windows 선택 기능인
  OpenSSH Server를 활성화하고 서비스를 시작하세요. 앱 실행 계정의 SSH 키로 종료 권한이 있는
  대상 계정에 로그인하도록 설정하세요. 최초 호스트 키 확인은 터미널에서 수행해야 합니다.
  앱은 `BatchMode=yes`, `StrictHostKeyChecking=yes`를 사용하고 비밀번호를 저장하지 않습니다.
  Windows에서 앱을 실행한다면 OpenSSH Client도 설치해야 합니다.

SSH 준비 확인(앱과 같은 OS 사용자로 실행):

```sh
ssh -p 22 사용자명@대상IP
```

표시된 호스트 키 지문을 대상 PC와 대조한 뒤 연결을 확인하세요. 키 인증 설정 후 다음 명령이
비밀번호 입력 없이 성공하는지 확인하면 됩니다(종료를 실행하지 않는 검사입니다).

```sh
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -p 22 사용자명@대상IP whoami
```

OFF는 `shutdown.exe /s /t 0`을 실행합니다. 강제 종료(`/f`)는 사용하지 않아 실행 중인 앱이
종료를 막을 수 있습니다. 개별/전체 OFF에는 확인 창이 표시됩니다. WOL 전송 또는 종료 명령 수락은
실제 부팅/종료 완료를 뜻하지 않습니다. RDP 통신 표시는 TCP 포트 도달 여부이며, 미응답이
전원 꺼짐을 의미하지 않습니다. 상태는 목록을 순서대로 검사한 뒤 10초 후 다시 검사합니다.

별도의 자체 에이전트는 사용하지 않습니다. SSH 서비스/키 설정과 Windows RPC 권한이 모두
없다면 IP·MAC만으로 원격 종료할 수 없습니다. 관리자 인증, 허브 탐색 및 다른 메뉴는 미연동입니다.

설정 참고: [Windows 원격 종료](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/shutdown/),
[Windows OpenSSH](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse),
[SSH 키 인증](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement),
[WOL 지원 상태](https://learn.microsoft.com/en-us/windows/win32/power/system-power-states).
