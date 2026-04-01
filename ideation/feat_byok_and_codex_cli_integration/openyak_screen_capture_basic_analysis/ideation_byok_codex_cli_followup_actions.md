# Ideation: 멀티 웹뷰·교차검증 결과를 활용한 후속 작업 (BYOK · Codex CLI · 커넥터)

**문서 상태**: 아이데이션 전용 — 본 문서는 구현 전 요구·기술·제약 정리용이며, 구현 착수는 본 문서 검토 후 별도 결정으로 진행한다.  
**작성일**: 2026-03-30  
**개정**: 2026-03-30 — `references/desktop`(OpenYak 데스크톱 트리) 소스 기준으로 구현 세부사항 보강.  
**참고 UI**: 동일 디렉터리 내 OpenYak 화면 캡처(아래 표).  
**참고 코드**: 저장소 내 `references/desktop`(Upstream OpenYak 데스크톱 스냅샷; 라이선스·재배포 정책은 별도 확인).

---

## 1. 배경 및 목표

### 1.1 Sync Multi Chat에서의 맥락

앱은 여러 AI 서비스를 **BrowserView(Webview)** 로 동시에 띄우고, **통합 프롬프트 입력**, **Cross Check**, **스레드/마지막 응답 복사** 등으로 멀티 소스 결과를 수집·비교한다(`spec/Multi-AI-Chat-SRS-Unified.md` 용어 정의와 일치).

현재 워크플로우는 대부분 **브라우저 내 대화**에 머무르며, 사용자가 교차검증으로 얻은 **합의/정리된 산출물**을 바탕으로 **로컬 코드베이스 편집**, **이슈 생성**, **CLI 에이전트 실행** 같은 **후속 실행(액션)** 으로 이어지려면 수동 복사·붙여넣기·외부 도구 전환이 필요하다.

### 1.2 본 기능이 지향하는 가치

- **입력**: 멀티 웹뷰에서 나온 텍스트(또는 사용자가 고른 발췌)를 **후속 작업의 단일 컨텍스트**로 승격.
- **처리**: 사용자가 신뢰하는 **자격 증명(BYOK 또는 구독 연동)** 과 **에이전트 모드(계획만 / 매번 승인 / 자동)** 로 로컬 또는 API 기반 작업 실행.
- **출력**: GitHub·Slack·Notion 등 **외부 시스템 반영** 또는 **Codex CLI 등 로컬 CLI** 실행 결과를 앱 내에서 추적.

OpenYak 캡처는 이 세 축(**프로바이더/BYOK**, **플러그인·스킬·MCP 커넥터**, **원격 접속·로컬 실행**)을 한 제품 안에 묶은 **참조 UX**로 활용한다.

---

## 2. 참고 스크린(OpenYak) 요약

| 파일명 | 화면 요약 | Sync Multi Chat에 주는 시사점 |
|--------|-----------|--------------------------------|
| `new_chat.png` | 신규 작업 화면: 모델 선택(GPT-5.x / Codex 계열), "Entire computer", **Ask before edits**, 하단 카드(스프레드시트·웹조사·PDF 추출·배치) | **에이전트 모드** + **작업 범위(워크스페이스)** + **템플릿형 후속 작업** UI 패턴 |
| `new_chat_mode_expand.png` | 모드 확장: **Plan** / **Ask before edits** / **Edit automatically** | 교차검증 후에도 **안전한 기본값**(Plan 또는 Ask)을 두는 정책 |
| `plugins_and_skills_connectors.png` | Connectors 탭: Slack·Notion·GitHub 등 카테고리별 토글 | **후속 작업 = 커넥터 목록 + 온오프** 구조 |
| `plugins_and_skills_connectors_add_custom.png` | **+ Add custom**, URL 예시 `https://mcp.example.com/mcp` | **MCP 서버 URL 등록**으로 확장 가능한 통합 축 |
| `plugins_and_skills_plugins_expanded.png` | Plugins 탭: 플러그인별 Skills·Required Connectors | **기능 번들링**(도메인 플러그인 + 필수 커넥터) 모델 |
| `settings_openai_codex_authenticate_request.png` | Settings > Providers: OpenYak / **Own API Key** / **ChatGPT Subscription** / Ollama, 콜백 URL 붙여넣기 | **다중 백엔드** 및 **웹 로그인 콜백** 기반 연동 |
| `settings_openai_codex_oauth_screeb.png` | 브라우저: `auth.openai.com/.../codex/consent` — Codex 연동 동의, "채팅 기록은 Codex에 전달되지 않음", **코드·커맨드 검토 경고** | **공식 OAuth·정책 문구** 및 **사용자 경고** 수준의 안전 UX |
| `remote_access.png` | Remote Access 꺼짐: 토글·QR·터널 URL 안내 | 로컬 실행기와 **외부 UI(폰 등)** 브릿지 패턴 |
| `remote_access_on.png` | Remote Access 켜짐: TryCloudflare URL, **Token**, **Permission Mode**(Auto-approve safe / Ask every time / Deny all) | **터널 + 회전 토큰 + 도구 승인 정책** |

---

## 3. 요구사항 정의

요구사항은 EARS 스타일로 기술해 이후 SPEC/테스트와 연결하기 쉽게 한다.

### 3.1 사용자 스토리(요약)

- **US-1**: 멀티 웹뷰에서 수집·교차검증한 텍스트를 선택해 **후속 작업 패널**에 넣고, 미리 정의된 작업(예: "요약을 이슈 본문으로", "PR 초안 설명 작성")을 실행하고 싶다.
- **US-2**: OpenAI **API 키(BYOK)** 또는 **구독/공식 로그인 경로**로 Codex·코딩 에이전트를 쓰고 싶다(제품 정책·이용약관 범위 내).
- **US-3**: Slack/GitHub 등은 **MCP 또는 공식 API**로 연결해, 채팅 산출물을 외부 시스템에 반영하고 싶다.
- **US-4**: 파일/명령 실행은 **Plan → 승인 → 실행** 단계로 통제하고, 위험한 작업은 기본 차단하고 싶다.

### 3.2 기능 요구사항(초안)

| ID | 요구사항 |
|----|----------|
| FR-1 | **WHEN** 사용자가 Cross Check 또는 복사 기능으로 생성한 텍스트 블록을 선택할 **THEN** 앱은 해당 블록을 **후속 작업 입력 컨텍스트**로 저장·표시할 수 있어야 한다. |
| FR-2 | **WHERE** 후속 작업이 로컬 CLI(Codex CLI 등)를 호출할 **THEN** 사용자는 **작업 디렉터리**, **환경 변수(키는 OS 시크릿/키체인 연계 권장)**, **dry-run/미리보기** 중 최소 한 가지 안전 장치를 사용할 수 있어야 한다. |
| FR-3 | **WHILE** 외부 커넥터가 활성화되어 있을 **THEN** 사용자는 연결 상태와 **권한 범위**(읽기 전용 vs 쓰기)를 UI에서 확인할 수 있어야 한다. |
| FR-4 | **IF** 사용자가 "자동 편집" 또는 동등한 고위험 모드를 선택할 **THEN** 앱은 명시적 경고와 **되돌리기 가능 여부**(예: git 작업 트리)를 안내해야 한다. |
| FR-5 | **WHEN** BYOK 또는 OAuth 토큰을 저장할 **THEN** 평문 설정 파일 저장은 지양하고, OS별 보안 저장소 또는 암호화 저장을 **SHALL** 우선 검토한다. |

### 3.3 비기능 요구사항(초안)

| ID | 항목 | 내용 |
|----|------|------|
| NFR-1 | 보안 | API 키·리프레시 토큰·터널 토큰은 로그/크래시 리포트에 포함되지 않아야 한다. |
| NFR-2 | 규정 준수 | 각 AI 서비스 **ToS**: 웹뷰 자동화·스크래핑·세션 하이재킹은 해당 서비스 정책과 충돌할 수 있으므로 **공식 API/OAuth/구독 허용 경로**만 전제로 한다. |
| NFR-3 | 신뢰성 | CLI/MCP 호출 실패 시 사용자에게 **exit code·stderr 요약**을 보여야 한다. |
| NFR-4 | 확장성 | 커넥터 추가는 **MCP URL 등록** 같은 플러그인형 확장을 1차 목표로 두되, 초기에는 소수 하드코드 통합도 허용(단계적). |

---

## 4. 기술적 검토

### 4.1 Sync Multi Chat 아키텍처와의 접점

- **Electron Main / Renderer / Preload**: 현재 IPC는 프롬프트 전송·스레드 복사·Cross Check 등에 집중되어 있다. 후속 작업은 **새 IPC 채널**(예: `run-followup`, `mcp-status`, `codex-exec`)과 **Main 프로세스에서의 자식 프로세스 spawn** 또는 **MCP 클라이언트**가 자연스럽다.
- **Webview 한계**: 웹뷰 내부 DOM에 의존한 "답변만 자동 추출"은 **취약하고 ToS 리스크**가 크다. 1차는 이미 구현된 **복사 파이프라인**(사용자 명시적 동작)과 **마스터 입력 재주입**을 **신뢰 가능한 데이터 소스**로 삼는 편이 안전하다.

### 4.1a OpenYak 대비 스택 차이(요약)

| 측면 | OpenYak (`references/desktop`) | Sync Multi Chat |
|------|----------------------------------|-----------------|
| 데스크톱 셸 | **Tauri(Rust)** — 백엔드 URL·윈도우·다운로드 IPC | **Electron** — BrowserView 다중 임베드 |
| "에이전트/도구" 런타임 | **로컬 FastAPI(Python)** 가 세션·도구·MCP·원격 인증 담당 | **없음** — 각 AI는 외부 웹뷰 안에서만 동작 |
| 프론트엔드 | **Next.js** — `getBackendUrl()`로 데스크톱 시 동적 베이스 URL | 정적 HTML/JS 렌더러 |
| 후속 작업을 넣으려면 | 이미 백엔드에 도구·MCP·원격이 있음 | **Main 또는 별도 로컬 서비스**를 새로 두거나, **외부 CLI만 얇게 호출**하는 최소 경로 선택 |

OpenYak은 **"단일 로컬 API 서버 + 단일 SPA"** 이고, SMC는 **"다중 외부 웹 챗 + 얇은 오케스트레이션"** 이므로, OpenYak 패턴을 가져올 때는 **Python 백엔드 전체를 이식하기보다**, 아래 **4.6절 모듈 매핑**처럼 **개념·API 설계만 선별 이식**하는 편이 현실적이다.

### 4.2 BYOK 및 OpenAI / Codex 연동

- 캡처의 **Own API Key**, **ChatGPT Subscription + 콜백 URL**, **Codex OAuth 동의 화면**은 서로 다른 신뢰 경계다.
- **API 키(BYOK)**: 구현 단순도는 높으나 키 유출·요금 폭주·키 로테이션 UX가 이슈.
- **구독/브라우저 OAuth**: 사용자 경험은 좋으나 **리다이렉트 URI 등록**, **PKCE**, **토큰 저장**, **리프레시**를 앱이 책임져야 하며, OpenAI 측 **Codex CLI / API 공개 정책**을 반드시 최신 문서로 확인해야 한다(아이데이션 단계에서는 법무·정책 확인을 전제로 둔다).
- OpenYak 동의 문구에 나온 것처럼 **"Codex가 쓰는 코드와 실행 커맨드를 검토"** 는 제품 요구사항으로 **UI·플로우에 반영**해야 한다.

### 4.3 Codex CLI 통합 방식(옵션)

| 접근 | 개요 | 장점 | 단점 |
|------|------|------|------|
| A. **Thin wrapper** | Main에서 `codex` CLI를 인자·stdin으로 호출, stdout/stderr을 UI에 스트리밍 | 구현 빠름, 버전 업그레이드가 CLI에 위임 | CLI 설치·PATH·플랫폼 차이, 샌드박스 |
| B. **공식 SDK/API** | Node에서 HTTP/gRPC 등으로 호출(가능 시) | 통제·테스트 용이 | 공개 API 가용성·이용 조건 의존 |
| C. **작업 큐 + 워커** | 후속 작업을 큐에 넣고 별도 프로세스가 순차 실행 | 장시간 작업·취소에 유리 | 복잡도 증가 |

권장 방향(아이데이션): **1단계 A**, 장기 **B 검토**, 고부하 시 **C**.

### 4.4 MCP 커넥터(OpenYak `mcp.example.com` 패턴)

- **MCP**는 도구·리소스를 표준화하므로, "GitHub 이슈 생성" 등을 **한 번 MCP 서버로 추상화**하면 Sync Multi Chat은 **MCP 클라이언트** 역할에 집중할 수 있다.
- Electron 앱에서 MCP를 쓰려면 **stdio 전송**(로컬 프로세스) 또는 **SSE/HTTP**(원격 서버) 선택이 필요하다. 보안상 **로컬 MCP + 사용자가 신뢰하는 서버만 등록**이 기본안.

### 4.5 Remote / 터널 패턴

- OpenYak은 **Cloudflare TryCloudflare**류 터널 + **회전 토큰** + **Permission Mode**로 원격에서 로컬 작업을 트리거한다.
- Sync Multi Chat에 그대로 넣을 경우 **공격 표면이 크게 증가**한다. 아이데이션 상 **기본 제품 범위에서 제외**하거나, **명시적 opt-in + 짧은 수명 토큰 + IP 제한 + Deny all 기본** 등을 전제로 한 **별도 실험 기능**으로 격리하는 편이 안전하다.

### 4.6 OpenYak 참조 구현 매핑 (`references/desktop`)

아래는 실제 코드 트리를 읽어 정리한 **구현 단위**이다. SMC에 이식 시 **동일 언어/구조를 따를 필요는 없고**, 책임 분리와 API 경계를 맞추는 용도로 쓴다.

#### 4.6.1 전체 레이어

1. **`desktop-tauri/`** — Rust: Python 백엔드를 **자식 프로세스**로 기동·헬스체크·워치독·종료(`desktop-tauri/src-tauri/src/backend.rs`). 프론트는 `get_backend_url` 등 Tauri 커맨드로 `http://127.0.0.1:{port}` 를 받는다(`commands.rs`).
2. **`backend/`** — FastAPI: 채팅 세션, 도구 실행, MCP, 커넥터, 원격 접속, 프로바이더 레지스트리.
3. **`frontend/`** — Next.js: React Query로 `/api/...` 호출; 데스크톱에서는 절대 URL로 백엔드 직통(`lib/constants.ts`, `lib/api.ts`).

#### 4.6.2 MCP · 커넥터

| 역할 | OpenYak 위치 | 동작 요약 |
|------|----------------|-----------|
| MCP 서버 생명주기 | `backend/app/mcp/manager.py` (`McpManager`) | 설정된 서버마다 `McpClient` 생성, `startup()`에서 연결, `tools()`로 도구를 앱 `ToolDefinition`으로 래핑(`McpToolWrapper`). OAuth 토큰은 `McpTokenStore`에서 주입·리프레시. |
| 전송 방식 | `backend/app/mcp/client.py` (`McpClient`) | `type: local` → **stdio**(`mcp.client.stdio`); 원격 → **SSE / streamable HTTP**(`sse_client`, `streamablehttp_client`). URL 필수. |
| 커넥터 단일 창구 | `backend/app/connector/registry.py` (`ConnectorRegistry`) | 플러그인의 MCP 엔트리를 **URL 기준 중복 제거**, `referenced_by`로 역참조, 사용자 **custom** CRUD, 상태는 `.openyak/connectors.json` 등에 지속. |
| 프론트 타입 | `frontend/src/types/connectors.ts`, `mcp.ts` | `ConnectorInfo`(builtin/custom, `referenced_by`, `tools_count`, `status`) / `McpServerStatus`. |
| API 훅 | `frontend/src/hooks/use-mcp.ts` | `GET` 상태, `POST` reconnect / auth start / disconnect. |

**SMC 이식 시**: Electron Main에서 **Node 기반 MCP 클라이언트**를 쓰거나, **얇은 로컬 sidecar(예: Python/Node 한 프로세스)** 로 OpenYak의 `McpManager` 역할만 포팅하는 선택지가 있다. 플러그인 `.mcp.json` 파서까지 가져오면 OpenYak과 유사한 **커넥터 카탈로그 + 커스텀 URL** UX에 근접할 수 있다(`backend/app/plugin/parser.py` — `mcpServers` 원격 URL·로컬 커맨드 파싱, 테스트는 `tests/test_plugin/test_parser.py`).

#### 4.6.3 플러그인 · 스킬

- 플러그인 디렉터리: `.claude-plugin/plugin.json`, **`.mcp.json`**, `skills/*/SKILL.md` 파싱(`backend/app/plugin/parser.py`).
- 로더·매니저·에이전트 변환: `backend/tests/test_plugin/` 및 `app/plugin/` 모듈군 — **스킬 = 마크다운 프롬프트/메타**, **MCP = 외부 도구 공급원**으로 결합.

**SMC 이식 시**: "스킬"을 **Custom Prompt Builder / Prompt Hub** 템플릿과 정렬하고, "도구"는 MCP 또는 CLI 한 축으로만 두어 **중복 개념을 줄이는 것**이 유지보수에 유리하다.

#### 4.6.4 BYOK · 프로바이더

- `backend/app/config.py` (`Settings`, `OPENYAK_` 프리픽스): 다수 `*_api_key`, **OpenAI OAuth** 필드(`openai_oauth_access_token` 등), Ollama, 프록시 URL/토큰 등.
- OAuth·구독 흐름은 `backend/tests/test_provider/test_openai_oauth.py` 등이 있음 — UI의 "콜백 URL 붙여넣기"와 연동.

**SMC 이식 시**: 웹뷰 안 ChatGPT가 아니라 **후속 Codex/로컬 에이전트**만 BYOK 대상으로 삼으면 키 저장 범위가 명확해진다.

#### 4.6.5 원격 접속(터널 · 토큰 · 미들웨어)

| 구성요소 | 경로 | 내용 |
|----------|------|------|
| 터널 | `backend/app/auth/tunnel.py` | `cloudflared tunnel --url http://localhost:{port}` 서브프로세스, stdout에서 `*.trycloudflare.com` URL 정규식 추출, 바이너리 없으면 GitHub에서 **플랫폼별 다운로드**. |
| 토큰 | `backend/app/auth/token.py` | 접두사 `openyak_rt_`, `secrets.token_urlsafe(32)`, 디스크 JSON 저장, `compare_digest` 검증. |
| 관리 API | `backend/app/api/remote.py` | `POST /remote/enable|disable`, `GET /remote/status`, `GET /remote/qr` — QR 페이로드 `{tunnel}/m?token=...` (**localhost 전용** 관리 엔드포인트는 `_localhost_only`). |
| 인증 | `backend/app/auth/middleware.py` (`RemoteAuthMiddleware`) | `remote_access_enabled` 일 때만: **localhost는 통과**, 그 외 `/api/*`는 **Bearer 또는 `?token=`**, SSE 버퍼링 방지를 위해 **순수 ASGI** 미들웨어. **분당 요청·실패 인증** 레이트 리밋. |
| 설정 | `config.py` | `remote_tunnel_mode`: `cloudflare` \| `manual`, `remote_permission_mode`: `auto` \| `ask` \| `deny`. |
| 모바일/원격 클라이언트 | `frontend/src/lib/remote-connection.ts` | `localStorage`에 `{url, token}`; `parseQRData`가 URL 쿼리·레거시 JSON 지원; `api.ts`가 원격 모드에서 **Authorization: Bearer** 주입. |

**참고**: `remote_permission_mode`는 설정·상태 API에 노출되나, 에이전트 쪽 파일/도구 승인은 별도 **`app/agent/permission.py` + `session/processor.py`** 의 규칙 병합(`allow`/`deny`/`ask`, 패턴 매칭)으로 처리된다. UI의 "Permission Mode"와 **세션 퍼미션 엔진**이 1:1로 같은 변수만 쓰는지는 SMC 이식 시 **명시적으로 설계**할 것.

#### 4.6.6 에이전트 모드(Plan / Ask / Auto)와 도구

- 에이전트 메타·퍼미션 스키마: `frontend/src/types/agent.ts` ↔ 백엔드 `app/schemas/agent.py`(테스트 `test_agent/`).
- 세션 처리기에서 도구 호출 전 **`evaluate` + `_ask_permission`** (`app/session/processor.py` 주석·grep) — OpenYak 스크린의 "Ask before edits"에 대응하는 **서버 측 게이트**.

**SMC 이식 시**: Codex CLI를 호출하기 전 **동일한 3단계 UX**(plan-only 미리보기 / 매회 확인 / 자동)를 **Electron 다이얼로그 또는 전용 패널**로 구현할지 결정해야 한다.

---

## 5. 구현 방안(로드맵 제안)

구현은 사용자 요청에 따라 **단계 분리**를 권장한다. 각 단계 옆에 **OpenYak에서 대응하는 구현 단서**를 적어, `references/desktop` 코드를 따라갈 때의 **탐색 앵커**로 쓴다.

| Phase | SMC 목표 | OpenYak 참조(코드) |
|-------|----------|---------------------|
| 0 | 정책·범위 | `backend/app/config.py` 프로바이더·원격 플래그, 각 서비스 ToS |
| 1 | 컨텍스트 승격 | 직접 매핑 없음 — OpenYak은 단일 채팅 세션 중심; **복사→세션 첨부**에 가까운 것은 `frontend` `API.FILES.*`, `SESSIONS` |
| 2 | 로컬 CLI MVP | `backend/app/tool/` 내 서브프로세스·워크스페이스 도구(예: `subprocess_compat.py` 패턴), 세션 루프는 `session/processor.py` |
| 3 | BYOK | `Settings` + `frontend/src/lib/constants.ts` 의 `CONFIG.PROVIDERS`, `OPENAI_SUBSCRIPTION_MANUAL_CALLBACK` 등 |
| 4 | MCP·커넥터 | `McpManager`, `ConnectorRegistry`, `API.MCP.*`, `API.CONNECTORS.*`, `use-mcp.ts` / `use-connectors.ts` |
| 5 | 원격 | `TunnelManager`, `app/api/remote.py`, `RemoteAuthMiddleware`, `remote-connection.ts` |

### Phase 0 — 정책·범위 확정(비코드)

- OpenAI·기타 서비스 **공식 허용 경로**만 사용할지, Codex CLI **배포·인증 방식**을 어떤 조합으로 지원할지 결정.
- **데이터 최소화**: 멀티 웹뷰 전체 스레드가 아니라 **사용자가 지정한 스냅샷**만 후속 작업으로 전달.

### Phase 1 — "컨텍스트 승격" UX

- Cross Check / Copy Last Response / Copy Chat Thread 결과를 **후속 작업 버퍼**로 보내기.
- 버퍼 내용 편집·미리보기·토큰 추정(선택).

### Phase 2 — 로컬 실행 최소 기능(MVP)

- **작업 디렉터리** 고정, **명령 템플릿**(예: `codex --help` 수준부터), **Ask before run**(실행 전 확인 다이얼로그).
- stdout/stderr 로그 패널, 실행 시간, 취소.
- **OpenYak에서 빌려올 만한 것**: 자식 프로세스 실행 시 **플랫폼별 플래그**(Windows 프로세스 그룹 분리 등) — `backend.rs` / `app/tool/subprocess_compat.py` 참고.

### Phase 3 — BYOK 저장소

- OS 자격 증명 저장소 연계(Windows Credential Locker 등), 환경 변수 주입만 지원해도 됨(키는 파일에 쓰지 않음).
- **OpenYak은** Pydantic Settings + 파일/DB에 OAuth 필드를 두는 방식 — SMC는 **Electron safeStorage** 등으로 **평문 JSON 저장을 피하는 것**이 목표면 설계가 엇갈리므로, **UI 플로우만 참고**하는 것이 안전하다.

### Phase 4 — MCP 커넥터 레지스트리

- `+ Add custom` 에 해당하는 **MCP 엔드포인트 등록 UI**, 연결 테스트, 도구 목록 표시.
- 소수 **레퍼런스 커넥터**(예: 로컬 파일시스템 읽기 전용)로 검증.
- **OpenYak REST 표면(프론트 상수 기준)**: `GET /api/mcp/status`, `POST /api/mcp/{name}/reconnect|auth-start|auth-callback|disconnect`; `GET/POST /api/connectors` 및 `.../enable|disable|connect|disconnect|token|reconnect`. SMC는 엔드포인트 이름을 그대로 쓸 필요는 없으나 **리소스 모델**(커넥터 1건 = MCP 서버 1 connection)은 동일하게 가져가기 쉽다.

### Phase 5 — (선택) 원격 트리거

- 터널·토큰·권한 모드까지 포함 시 **보안 설계 문서** 별도 필수.
- **OpenYak 구현 체크리스트(복제 시)**:
  - 관리 API(`enable`/`disable`/`status`/`qr`)는 **localhost 한정**(`_localhost_only`).
  - 데이터 경로에 **토큰 JSON** 저장 시 디렉터리 권한·백업 정책 검토.
  - `RemoteAuthMiddleware`: localhost **우회**, 비로컬은 Bearer/`?token=`, **SSE 호환 ASGI** 유지.
  - `cloudflared` **quick tunnel**은 URL이 매 세션 바뀔 수 있음 — UX에 "URL 변경" 안내.
  - 프론트: 원격 모드에서 **모든 API**에 Bearer 주입(`api.ts` 패턴) + SSE URL만 터널 호스트로 치환(`API.CHAT.STREAM`).

---

## 6. 예상 제약 사항 및 리스크

### 6.1 서비스 약관·컴플라이언스

- 웹뷰에 로그인된 세션을 **무단으로 자동 스크래핑**하는 방식은 차단·계정 제재·법적 리스크가 있다. **사용자가 명시적으로 복사한 콘텐츠** 또는 **공식 API** 기반이 현실적이다.

### 6.2 Electron·OS 보안

- **임의 셸 실행**은 RCE에 가깝다. 인젝션 방지(인자 배열 사용, 셸 비사용), **허용 명령 화이트리스트** 또는 **설정된 프로파일만** 실행하는 것이 바람직하다.

### 6.3 Codex CLI 의존성

- CLI 버전·플래그·인증 방식이 변하면 앱도 따라야 한다. **버전 고정 문서화**와 **기능 플래그**로 완화.

### 6.4 MCP·외부 서비스

- 각 커넥터는 **OAuth 클라이언트 ID**가 필요할 수 있어, Sync Multi Chat이 **공식 OAuth 앱**을 등록해야 하는지, 사용자 개인 앱 키를 쓰는지에 따라 UX가 달라진다.

### 6.5 원격 접속(터널)

- URL·토큰 유출 시 **로컬 머신 제어**로 이어질 수 있다. 기본 비활성, 짧은 TTL, 회전, 감사 로그를 권장.

### 6.6 프라이버시

- 교차검증 텍스트에 **개인정보·기밀**이 포함될 수 있다. 후속 작업 전 **마스킹·삭제 UI**를 고려한다.

---

## 7. 성공 지표(아이데이션 → 구현 시 측정)

- 후속 작업 실행까지의 **클릭/단계 수**(기준: 대비 % 감소).
- 실행 실패 시 **복구 가능 비율**(로그로 원인 파악).
- 보안 사고·키 유출 **0건**을 릴리스 게이트로 둘지 여부.

---

## 8. 캡처 자산 인덱스

동일 폴더 파일:

- `new_chat.png`, `new_chat_mode_expand.png`
- `plugins_and_skills_connectors.png`, `plugins_and_skills_connectors_add_custom.png`, `plugins_and_skills_plugins_expanded.png`
- `settings_openai_codex_authenticate_request.png`, `settings_openai_codex_oauth_screeb.png`
- `remote_access.png`, `remote_access_on.png`

---

## 9. 다음 단계(구현 전 체크리스트)

1. 본 문서의 **Phase 범위** 중 제품 우선순위 확정.  
2. **OpenAI Codex CLI / API** 최신 공식 문서로 인증·ToS 재확인.  
3. **MVP = Phase 1 + Phase 2** 로 줄일지, MCP까지 포함할지 결정.  
4. 승인 후 별도 SPEC/EARS 문서로 세분화 및 테스트 전략(특히 **명령 실행 샌드박스**) 수립.  
5. OpenYak 코드를 참고할 경우: `references/desktop`의 **라이선스**(서브트리·포크 여부)와, **상표/브랜딩**을 SMC 제품에 혼동 없이 쓰는지 확인.  
6. `remote_permission_mode`(설정)와 **세션 도구 승인 엔진**(`permission.py`)의 관계를 SMC에서 어떻게 맞출지(단일 토글 vs 이중 정책) 결정.

---

## 부록 A. OpenYak 백엔드 API 표면(발췌)

`frontend/src/lib/constants.ts`의 `API` 객체에 정의된 경로 중, 후속 작업·통합과 직접 맞닿는 것만 발췌한다. 전체 목록은 해당 파일을 본다.

| 영역 | 예시 경로 | 용도 |
|------|-----------|------|
| MCP | `/api/mcp/status`, `/api/mcp/{name}/reconnect`, `.../auth-start`, `.../disconnect` | 서버 상태·재연결·OAuth 시작 |
| Connectors | `/api/connectors`, `POST` 추가, `/{id}/enable|disable|connect|disconnect|token|reconnect` | UI의 Connectors 탭과 대응 |
| Plugins / Skills | `/api/plugins/status`, `/api/plugins/{name}/enable`, `/api/skills/...` | 플러그인 번들·스킬 토글 |
| Config / Providers | `/api/config/providers`, `.../openai-subscription/manual-callback` 등 | BYOK·구독 콜백 |
| Remote | `/api/remote/enable`, `/api/remote/disable`, `/api/remote/status`, `/api/remote/qr`, `/api/remote/rotate-token`, `/api/remote/config` 등 (`router.py`에서 `prefix=/api` 하위에 `remote` 라우터 포함) | 터널·토큰·QR·설정 |
| Chat / Stream | `/api/chat/prompt`, `/api/chat/stream/{streamId}` | 원격 시 SSE URL 치환 |

부록은 **SMC가 동일 API를 구현해야 한다는 뜻이 아니라**, "기능을 쪼개면 이 정도의 REST 경계가 나온다"는 **설계 힌트**다.

---

*본 문서는 OpenYak 스크린샷과 `references/desktop` 소스에 보이는 UX·아키텍처를 **참조 모델**로 정리한 것이며, 제3자 제품의 구현·상표·서비스 약관·라이선스와의 정합은 구현 전 법무·정책 검토가 필요하다.*
