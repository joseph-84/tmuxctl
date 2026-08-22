# Changelog

## 2026-08-22

### 추가
- **최초 구현** (`4b36706`) — Claude Design 캔버스(`tmuxctl A - Console Shell.dc.html`)를 실제 동작하는
  풀스택 앱으로 구현. Node/Express 백엔드 + React 프런트엔드, PAM 로그인, 실제 `tmux` CLI 제어,
  `node-pty` + WebSocket으로 스트리밍되는 실 터미널, sudoers 화이트리스트 wrapper를 통한
  Linux 시스템 사용자 관리. `deploy/`에 sudoers/PAM/systemd 유닛/install 스크립트 포함.
- GitHub 공개 저장소 생성 및 push: https://github.com/joseph-84/tmuxctl

### 변경
- **새 세션 생성 모달 단순화** (`d6af46a`) — 작업 디렉터리 / 시작 명령 / 레이아웃 템플릿 입력 제거.
  이제 세션 이름만 입력하면 되고, 시작 위치는 항상 서비스 계정의 홈 디렉터리로 고정.
- **`bootstrap.sh` 개선** (`dde31a3`) — node/npm/tmux/gcc/python3/libpam0g-dev 중 없는 것만 감지해서
  apt로 자동 설치. 마지막에 systemd 시작 프로그램 등록 여부를 물어보도록 변경(기본값 N).

### 보안
- **SAST/DAST/SBOM 점검 후 수정** (`93c5154`) — 직접 의존성 `cookie`(GHSA-pxg6-pf52-xh8x)와
  `vite`/`esbuild`(개발 서버 관련 다건) 취약 버전 업그레이드. `/api/login`에 브루트포스 방어
  (계정당 15분 내 5회 실패 시 15분 잠금, `server/loginThrottle.js`) 신규 추가. 쿠키 `path` 명시,
  `TMUXCTL_SECURE_COOKIE` 미설정 시 기동 경고, helmet 없이 기본 보안 헤더 3종 추가.
  SBOM(CycloneDX)·Trivy·Semgrep 스캔 결과 전달, 잔여 오탐 항목 코드 검토 후 근거와 함께 보류.

### 수정
- **터미널 화면 깨짐** (`3bb9f4e`) — xterm.js가 웹폰트(JetBrains Mono) 로딩 완료 전에 셀 크기를
  측정해서, 폰트가 늦게 적용되면 컬럼이 어긋나 패널이 겹쳐 보이던 문제. `document.fonts.ready` 이후
  재측정·재동기화하도록 수정.
- **tmux 상태줄이 기본값(초록 바)으로 보이던 문제** (`3bb9f4e`) — 설정 페이지를 한 번도 열지 않으면
  `~/.tmux.conf`가 생성되지 않던 문제. 서버 부팅 시 항상 기본 설정을 적용하도록 수정.
- **서비스 재시작 시 tmux 세션이 통째로 사라지던 문제** (`7076a3c`) — systemd 기본
  `KillMode=control-group`이 cgroup 전체에 종료 시그널을 보내 tmux 서버까지 죽이고 있었음.
  `KillMode=process`로 변경해 tmuxctl 재시작/재배포와 무관하게 tmux 세션이 유지되도록 수정
  (실서버에서 세션 생성 → 재시작 → 생존 확인 완료).
- **`nginx-proxy-manager` 뒤에서 실시간 터미널만 끊기던 문제** — 코드 수정이 아니라 인프라 설정 문제로
  확인: 프록시 호스트의 "Websockets Support"가 꺼져 있어 `/ws/terminal` 업그레이드가 막혀 있었음
  (REST API는 평문 HTTP라 정상 동작). NPM 관리 화면에서 토글 켜는 것으로 해결.

### 배포 이력
- 실서버(`joseph84-PN40`, `/data/services/tmuxctl`) 최초 배포 및 `systemctl --user` 서비스 등록
  (`enabled` + `loginctl enable-linger` 적용, 로그아웃/재부팅에도 자동 실행).
- 위 수정 사항들을 실서버에 순차 반영(`git pull` → `npm run build:web` → `systemctl --user restart`).
