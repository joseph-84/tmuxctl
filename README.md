# tmuxctl

Cockpit 스타일로 tmux 세션을 웹에서 관리하는 콘솔. 로그인은 서버의 PAM 계정을 그대로
쓰고, 세션/윈도우/페인은 전부 실제 `tmux` 명령을 호출한 결과이며, 터미널은 실제
`tmux attach-session`에 붙은 PTY를 그대로 스트리밍합니다 — 브라우저에서 보는 화면은
같은 세션에 SSH로 들어가 `tmux attach` 한 것과 동일합니다.

## 요구 사항

`node-pty`와 `authenticate-pam`은 네이티브 애드온이라 `npm install` 시 컴파일이
필요합니다. `deploy/bootstrap.sh`가 아래 목록을 스스로 확인해서 없는 것만
apt로 설치해주므로(Linux), 배포 시엔 이 절을 직접 따라 할 필요는 없습니다 —
로컬 개발 환경을 손으로 맞출 때 참고하세요.

- **Linux (Debian/Ubuntu 기준)**: `sudo apt-get install -y nodejs npm build-essential python3 libpam0g-dev tmux`
- **macOS**: Xcode Command Line Tools (`xcode-select --install`), `brew install tmux`. PAM 헤더는 시스템에 기본 포함. (`bootstrap.sh`는 Xcode CLT 설치 자체는 GUI 설치라 대신해주지 못하고, 없으면 안내만 하고 멈춥니다.)
- **공통**: Node.js 18 이상.

## 아키텍처

- **로그인**: `authenticate-pam` (네이티브 PAM 바인딩)으로 `/etc/pam.d/tmuxctl`
  서비스에 대해 인증. 별도 계정 DB 없음 — 서버의 시스템 계정/비밀번호 그대로.
- **권한 모델**: tmuxctl 프로세스는 **일반 계정**으로 돈다. `useradd`/`userdel`처럼
  root가 필요한 작업은 전부 `deploy/tmuxctl-useradmin` 이라는 단일 wrapper
  스크립트를 통해서만 실행하고, `/etc/sudoers.d/tmuxctl` 은 그 경로 하나에만
  `NOPASSWD` 를 허용한다. (server/sudoExec.js, deploy/tmuxctl-useradmin 참고)
- **tmux 제어**: `child_process.execFile("tmux", [...])` 로 `list-sessions` /
  `new-session` / `split-window` 등을 직접 호출 (server/tmuxctl.js). 셸을 거치지
  않으므로 인젝션 여지가 없음.
- **터미널**: 세션당 `tmux new-session -A -s <name>` 을 node-pty로 spawn 해서
  WebSocket(`/ws/terminal`)으로 그대로 스트리밍 (server/pty.js). 브라우저 탭을
  닫으면 그 pty(클라이언트)만 끊어지고 tmux 세션은 서버에서 계속 돈다 — 진짜
  tmux attach/detach와 동일한 동작.
- **역할**: `admin` / `operator` / `viewer` / `none` 4단계. 관리자/wheel/sudo
  그룹 멤버는 첫 로그인 시 자동으로 `admin`, 나머지는 기본 `none` (deny-by-default).
  `viewer` 는 터미널에 read-only 로 attach (키 입력이 서버에서 무시됨).

## 로컬 개발

```bash
npm install            # 백엔드 (node-pty, authenticate-pam 컴파일 필요 — build-essential, libpam0g-dev)
npm run setup:web       # 프런트 의존성
npm run dev:web          # http://localhost:5173 (vite, /api·/ws 는 4390으로 프록시)
npm run dev:server      # 다른 터미널에서: http://localhost:4390
```

개발 중 PAM/tmux 소켓은 실제 시스템 것을 그대로 쓰므로, 로그인 테스트를 하려면
이 머신에 실제 존재하는 계정/비밀번호가 필요합니다.

## 배포

**중요**: `node-pty`/`authenticate-pam`은 네이티브 애드온이라 그 서버의 OS/아키텍처에서
직접 컴파일해야 합니다 — 개발 머신에서 빌드해 `node_modules`를 통째로 복사하면 동작하지
않습니다. 실제로 tmuxctl을 돌릴 그 서버에서 아래를 실행하세요.

```bash
git clone … tmuxmgmt && cd tmuxmgmt
./deploy/bootstrap.sh
```

`bootstrap.sh`가 하는 일 (개별 실행하고 싶다면 순서대로):
1. **사전 요구 사항 확인/설치** — `node`/`npm`/`tmux`/`gcc`/`python3`/`libpam0g-dev`가
   있는지 확인하고, 없는 것만 골라 `sudo apt-get install`로 설치 (Linux). sudo 비밀번호를
   물어볼 수 있습니다. macOS는 Xcode CLT/brew 확인만 하고 자동 설치는 tmux만 해줍니다.
2. `npm install --omit=dev` — 백엔드 의존성 설치 + 네이티브 모듈 컴파일
3. `npm run setup:web && npm run build:web` — 프런트엔드를 `web/dist`에 정적 빌드 (더 이상 vite dev 서버 필요 없음 — `server/index.js`가 직접 서빙)
4. `./deploy/install.sh` — sudoers 화이트리스트 wrapper, PAM 서비스 파일, systemd 유닛 설치 (일반 유저로 실행, 내부에서 sudo 사용)
5. **시작 프로그램 등록 여부를 물어봄** — `y`를 입력하면 `systemctl --user enable --now tmuxctl.service` + `loginctl enable-linger`까지 실행해서 로그인 시 자동 시작되게 설정합니다. `N`(기본값)이면 등록하지 않고, 나중에 직접 켜는 명령만 안내합니다. 터미널이 아닌 곳(CI 등)에서 실행되면 입력을 받을 수 없으므로 자동으로 등록하지 않습니다.

이미 배포된 서버를 업데이트할 때도 `git pull && ./deploy/bootstrap.sh` 한 번이면
됩니다 (멱등적으로 짜여 있음) — 이미 설치된 항목은 다시 건드리지 않고, 시작 프로그램
등록 여부도 다시 물어봅니다.

기본 포트는 4390 (`PORT` 환경변수로 변경). 외부에 노출한다면 반드시 nginx/caddy
등으로 TLS를 앞단에 두고 `TMUXCTL_SECURE_COOKIE=1` 을 설정하세요 (평문 HTTP로는
세션 쿠키가 전송되지 않도록 막는 스위치입니다).

macOS는 `deploy/pam.d-tmuxctl` 상단 주석대로 `pam_opendirectory.so` 로 바꿔서
`/etc/pam.d/tmuxctl` 에 직접 설치해야 합니다 (`install.sh` 가 자동으로 하지 않음).
로그인·tmux 제어는 macOS에서도 그대로 동작하지만, **사용자 관리(사용자 생성/삭제)
페이지는 Linux 전용**입니다 — `deploy/tmuxctl-useradmin` 이 `useradd`/`userdel`을
쓰는데 macOS엔 없는 명령이라, 포팅하려면 `dscl`/`sysadminctl` 기반으로 새로
작성해야 합니다.

## 보안 메모

- 특권 작업은 전부 `tmuxctl-useradmin` 한 곳으로 좁혀놨습니다. 이 스크립트를 고치면
  sudoers 화이트리스트 전체의 신뢰 경계가 바뀌는 셈이니, 인자 검증 로직을 건드릴 땐
  특히 주의하세요.
- 세션 쿠키는 `express-session` 메모리 스토어를 씁니다 — 단일 프로세스용이며,
  프로세스를 재시작하면 로그인 세션이 전부 풀립니다. 다중 인스턴스로 스케일할
  계획이 없다면 (이 도구 특성상 없는 게 맞습니다) 문제 없습니다.
- `data/roles.json` 에 저장된 역할은 tmuxctl 앱 안에서만 의미가 있고, 실제 OS
  권한(sudo 그룹 등)과는 별개입니다.
