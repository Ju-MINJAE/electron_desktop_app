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
