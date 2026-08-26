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
- **tmux 마우스 모드는 기본 꺼짐**: 켜면 tmux가 드래그를 자체 마우스 리포팅으로
  가로채서, 브라우저에서 흔히 하는 "드래그로 선택 → Ctrl/Cmd+C 복사"가 안 되고
  선택 영역이 바로 풀립니다. 필요하면 설정 페이지에서 켤 수 있습니다
  (`server/settingsRoutes.js`의 `DEFAULTS.mouse`).

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

macOS(특히 Apple Silicon)에서는 `node-pty`가 패키지에 미리 번들해 둔
`spawn-helper` 바이너리의 실행 권한이 npm 설치 과정에서 유실되는 경우가 있어,
터미널을 열자마자 `posix_spawnp failed.`로 끊기는 증상이 있을 수 있습니다
(node-pty 쪽 패키징 이슈로 보이며, 저희 코드 문제는 아닙니다). `package.json`의
`postinstall` 스크립트가 `npm install` 때마다 자동으로 실행 권한을 복구하니
`bootstrap.sh`로 설치했다면 별도 조치가 필요 없습니다. 그래도 같은 에러가 나면:

```bash
chmod +x node_modules/node-pty/prebuilds/*/spawn-helper
```

macOS는 전용 PAM 서비스 파일을 만들지 않습니다 — SIP(System Integrity Protection)가
`/etc/pam.d/`에 새 파일을 추가하는 것 자체를 막아서 (root로 `install`/`tee`를 해도
"Operation not permitted"), `/etc/pam.d/tmuxctl` 같은 걸 만드는 게 애초에
불가능합니다. 대신 `server/config.js`가 macOS에서는 자동으로 Apple이 이미 제공하는
`login` 서비스(`/etc/pam.d/login`, 이미 `pam_opendirectory.so`로 인증)를 재사용하도록
`PAM_SERVICE` 기본값을 잡아줍니다 — 별도 설정 없이 됩니다. 다른 서비스를 쓰고 싶으면
`TMUXCTL_PAM_SERVICE` 환경변수로 바꿀 수 있습니다.

macOS는 systemd가 없어서 시작 프로그램 자동 등록도 아직 지원하지 않습니다 —
직접 실행하세요:

```bash
npm start
```

터미널 창을 그냥 닫으면 안 됩니다 — macOS 기본 셸(zsh)은 터미널을 닫을 때 그 안의
백그라운드 job에 SIGHUP을 보내서 `npm start`(node 프로세스)도 같이 죽습니다. tmux
세션 자체(별도 데몬)는 안 죽지만, 웹 UI는 접속이 끊깁니다. 터미널을 닫아도 계속
띄워두려면:

```bash
nohup npm start > ~/tmuxctl.log 2>&1 &
disown
```

끌 때는 (nohup으로 띄웠든 `npm start &`로 띄웠든) PID로 찾기보다 포트나 이름으로:

```bash
lsof -ti tcp:4390 | xargs kill
# 또는
pkill -f "node server/index.js"
```

재부팅 시 자동 시작까지 원하면 launchd `.plist`가 필요한데(Linux의 systemd 유닛에
해당), 아직 준비되어 있지 않습니다.

macOS는 systemd가 없어서(위 참고) `WorkingDirectory`를 강제할 방법이 없다 보니,
tmux 서버가 맨 처음 뜰 때의 `$PWD`가 어쩌다 이상한 값이면(예: 수동으로 여러 번
띄우다 보면) 그 뒤에 만든 세션들의 셸이 `pwd`를 이상하게 보여줄 수 있습니다 —
`tmux new-session -c` 로 실제 작업 디렉터리 자체는 항상 정확히 잡히고, 파일
접근에는 전혀 영향이 없는 화면 표시 문제입니다. `tmuxctl.js`가 세션 생성 직후
`tmux set-environment -t <세션> PWD <경로>` 로 세션 단위 환경변수를 다시 박아둬서,
새로 만드는 세션에서는 이 문제가 재발하지 않습니다.

로그인·tmux 제어는 macOS에서도 그대로 동작하지만, **사용자 관리(사용자 생성/삭제)
페이지는 Linux 전용**입니다 — `deploy/tmuxctl-useradmin` 이 `useradd`/`userdel`을
쓰는데 macOS엔 없는 명령이라, 포팅하려면 `dscl`/`sysadminctl` 기반으로 새로
작성해야 합니다.

### 제거

```bash
./deploy/uninstall.sh
```

`install.sh`(및 `bootstrap.sh`의 4단계)가 설치한 것들을 되돌립니다: systemd
서비스 중지/비활성화 및 유닛 파일 삭제, `/etc/sudoers.d/tmuxctl`,
`/usr/local/sbin/tmuxctl-useradmin`, `/etc/pam.d/tmuxctl` 제거. linger 해제와
`data/` 디렉터리(세션 메타데이터·역할·설정) 삭제는 실행 중 물어보며, 기본값은
"아니오"입니다. `node`/`npm`/`tmux`/`build-essential` 등 apt로 설치됐을 수 있는
시스템 패키지와 저장소 자체는 다른 용도로 쓰일 수 있어 건드리지 않으니, 필요하면
직접 지우세요.

## 보안 메모

- 특권 작업은 전부 `tmuxctl-useradmin` 한 곳으로 좁혀놨습니다. 이 스크립트를 고치면
  sudoers 화이트리스트 전체의 신뢰 경계가 바뀌는 셈이니, 인자 검증 로직을 건드릴 땐
  특히 주의하세요.
- 세션 쿠키는 `express-session` 메모리 스토어를 씁니다 — 단일 프로세스용이며,
  프로세스를 재시작하면 로그인 세션이 전부 풀립니다. 다중 인스턴스로 스케일할
  계획이 없다면 (이 도구 특성상 없는 게 맞습니다) 문제 없습니다.
- `data/roles.json` 에 저장된 역할은 tmuxctl 앱 안에서만 의미가 있고, 실제 OS
  권한(sudo 그룹 등)과는 별개입니다.
