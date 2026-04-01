# Ideation: BYOK & Codex CLI Integration for Sync Multi Chat

**Version**: Draft v0.2
**Date**: 2026-03-30
**Author**: Claude (AI-assisted ideation)
**Reference**: OpenYak desktop app screenshots + source code analysis (`references/desktop/`)
**Project**: Sync Multi Chat (MAPB - Multi AI Prompt Broadcaster)
**Current Version**: v0.9.1
**Revision Note**: v0.2 - OpenYak 소스 코드(backend/frontend/desktop-tauri) 분석 결과 반영, 기술 구현 방안 구체화

---

## 1. Executive Summary

Sync Multi Chat(SMC)은 현재 다수의 AI 서비스(ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark)에 동시 프롬프팅하고 교차검증하는 데스크톱 앱이다. 그러나 현재는 **"분석 도구"** 에 머물러 있으며, 교차검증된 결과를 실제 후속 작업으로 연결하는 **"실행 도구"** 로의 전환이 필요하다.

OpenYak의 접근 방식을 참고하여, SMC에 다음 핵심 기능을 도입한다:

1. **BYOK (Bring Your Own Key)**: 사용자 소유 API 키를 통한 직접 모델 접근
2. **Codex/Agent CLI 통합**: 교차검증된 데이터 기반의 실제 작업 실행 환경
3. **Plugins/Skills/Connectors 시스템**: 확장 가능한 도구 생태계
4. **Automations**: 반복 작업의 자동화
5. **Remote Access**: 모바일 원격 제어

이를 통해 SMC는 **"Cross-Verify → Decide → Execute"** 파이프라인을 완성한다.

---

## 2. OpenYak 스크린샷 분석 결과

### 2.1 Provider 설정 (settings_provider_setup.png, settings_openai_codex_authenticate_request.png, settings_openai_codex_oauth_screeb.png)

**관찰 사항:**
- 4가지 Provider 옵션: OpenYak Account, Own API Key, ChatGPT Subscription, Ollama
- ChatGPT Subscription은 OAuth 기반으로 사용자의 기존 ChatGPT Plus/Pro/Team 구독을 활용
- OAuth 플로우: `auth.openai.com/sign-in-with-chatgpt/codex/consent` 경유
- Callback URL 방식의 인증 (브라우저 → 앱으로 URL 복사/붙여넣기)
- 구독 플랜 한도, 언어 설정을 공유하며, 채팅 기록은 공유하지 않음
- Active 상태 표시 및 Disconnect 기능

**SMC 적용 시사점:**
- SMC는 이미 웹뷰 기반으로 사용자 구독을 활용 중 → OAuth 방식은 API 직접 호출 시 필요
- Own API Key(BYOK) 모드가 SMC의 핵심 확장 포인트
- Ollama(로컬 모델) 지원도 오프라인/프라이버시 시나리오에서 유의미

### 2.2 모델 선택 및 실행 모드 (new_chat.png, new_chat_mode_expand.png)

**관찰 사항:**
- 모델 드롭다운: GPT-5.4, GPT-5.3 Codex, GPT-5.2, GPT-5.2 Code, GPT-5.1 Codex, GPT-5.1 Codex Max, GPT-5.1 Codex Mini
- 모든 모델이 "INCLUDED" (구독 포함)
- 3가지 실행 모드:
  - **Plan mode**: 탐색/분석만, 파일 변경 없음
  - **Ask before edits**: 변경 전 사용자 확인 (기본값)
  - **Edit automatically**: 자동 변경
- "Entire computer" 파일 접근 옵션
- 빠른 작업: Summarize folder, Draft from notes, Rename photos, Organize bills
- 기능 카드: Spreadsheet Analysis, Web Research, Data Extraction, Batch Processing
- 메시지: "What do you want to produce today?" → 산출물 중심 워크플로우

**SMC 적용 시사점:**
- Codex 모델은 코딩 에이전트 특화 → SMC에서는 "교차검증 결과 기반 실행 에이전트" 개념으로 확장
- 실행 모드(Plan/Ask/Auto)는 SMC의 후속 작업 실행 시 안전장치로 도입 가능
- 파일 시스템 접근은 데이터 추출, 보고서 생성 등의 후속 작업에 필수
- Quick action 패턴은 SMC의 교차검증 결과에서 원클릭 후속 작업으로 연결 가능

### 2.3 Plugins & Skills 시스템 (plugins_and_skills_*.png)

**관찰 사항:**

**Connectors (46개):**
- 카테고리별 분류: Communication(1), Productivity(8), Developer Tools(4), Design(2), CRM(4), Analytics(5+)
- 각 커넥터: 이름, 설명, 토글 스위치
- Custom connector 추가: Name + MCP URL (https://mcp.example.com/mcp)
- MCP(Model Context Protocol) 기반 확장

**Plugins (15개, Built-in):**
- 도메인별: bio-research, cowork-plugin-management, customer-support, data, design, engineering, enterprise-search, finance, human-resources, legal, marketing, operations, product-management, productivity, sales
- 각 플러그인: 버전, Skills 수, Connectors 수, 토글 스위치
- 플러그인 확장 시 포함된 Skills 목록과 Required Connectors 표시

**Skills (22개, Built-in):**
- 작업 특화: algorithmic-art, canvas-design, charting, data-analysis, doc-coauthoring, document-summary, docx, email, frontend-design, mcp-builder, meeting-notes, pdf, pptx, presentation, report, research, skill-creator, theme-factory, translation, web-artifacts-builder, webapp-testing
- "bundled" 태그 표시

**SMC 적용 시사점:**
- SMC의 교차검증 결과물을 후속 처리할 도구 생태계 필요
- MCP 기반 커넥터는 표준화된 확장 메커니즘
- Skills은 SMC의 "교차검증 → 보고서/문서/프레젠테이션 생성" 파이프라인에 직접 활용 가능
- Plugin = Skills + Connectors 번들 개념은 도메인별 워크플로우 패키징에 유용

### 2.4 Automations (automations_*.png)

**관찰 사항:**
- 3개 탭: Active, All, Templates
- 5개 템플릿: 每日简报(Daily Briefing, 08:00), 每周回顾(Weekly Review, Fri 17:00), 邮件整理(Email Org, Weekdays 09:00), 代码审查摘要(Code Review, Weekdays 10:00), 工作区清理(Workspace Cleanup, Sat 12:00)
- 새 자동화 생성:
  - Name, Description, Prompt
  - Schedule: Scheduled(요일/시간 선택) / Interval(N시간 간격)
  - Model 선택: GPT-5.4 (Subscription)
  - Workspace: Unrestricted(global) 또는 특정 폴더 선택
- cron 표현식 지원

**SMC 적용 시사점:**
- SMC에서 "매일 아침 특정 주제를 3개 AI에 질문하고 교차검증 보고서 생성" 자동화 가능
- 교차검증 결과 기반 정기 모니터링 워크플로우
- Workspace 스코핑은 프로젝트별 자동화 격리에 유용

### 2.5 Usage Monitor (settings_usage_monitor.png)

**관찰 사항:**
- Overview: Credits Used, Total Tokens, Avg Response Time, Sessions
- Messages 수, Response Time 범위
- Key Insights (AI 분석)
- Token Breakdown: Input/Output/Reasoning 비율
- Daily Trend 차트 (Credits/Tokens 토글)
- Model Usage 테이블
- Top Sessions 목록 (토큰 소비량 기준)

**SMC 적용 시사점:**
- BYOK 모드에서 비용 추적은 필수
- 다중 AI 서비스의 비용 비교 대시보드는 SMC만의 차별화 포인트
- 어떤 AI가 더 효율적(적은 토큰, 빠른 응답, 높은 품질)인지 분석 가능

### 2.6 Remote Access (remote_access.png, remote_access_on.png)

**관찰 사항:**
- Cloudflare Tunnel 기반 원격 접근
- QR 코드 + URL 복사
- Token 기반 인증 (openyak_rt_...)
- Permission Mode: Auto-approve safe tools / Ask every time / Deny all
- "Tasks execute on this computer and results stream back"

**SMC 적용 시사점:**
- 데스크톱 실행 + 모바일 제어 패턴은 장시간 교차검증 작업에 유용
- Permission Mode는 원격에서의 안전한 에이전트 실행에 필수

---

## Appendix A. OpenYak 소스 코드 분석 (references/desktop/)

> 이 섹션은 v0.2에서 추가됨. OpenYak 전체 소스 코드를 분석하여 구현 패턴, 아키텍처, 핵심 데이터 모델을 정리한다.

### A.1 OpenYak 기술 스택 요약

| 계층 | 기술 | 비고 |
|------|------|------|
| **Desktop Shell** | Tauri 2.10.1 (Rust) | Electron 대비 경량, 네이티브 바이너리 |
| **Frontend** | Next.js 15.3 + React 19.1 + TypeScript 5.7 | App Router, Server Components |
| **UI Library** | Radix UI + shadcn/ui + Tailwind CSS 4.1 | 접근성 우선 컴포넌트 |
| **State Management** | Zustand 5.0 + React Query 5.72 | 클라이언트/서버 상태 분리 |
| **Backend** | Python 3.12 + FastAPI 0.115 + Uvicorn | Async-first 아키텍처 |
| **Database** | SQLite (aiosqlite) + SQLAlchemy 2.0 | ULID PK, JSON 컬럼 활용 |
| **LLM SDK** | openai, anthropic>=0.40, google-genai>=1.0 | 네이티브 SDK + OpenAI-compatible 어댑터 |
| **MCP** | mcp>=1.0 (Model Context Protocol) | stdio/SSE/HTTP 전송 지원 |
| **Scheduling** | croniter>=2.0 | cron 표현식 파싱 |
| **Token Counting** | tiktoken>=0.8 | OpenAI 토큰 카운팅 |
| **Document Processing** | pypdf, python-docx, openpyxl, pandas | 다양한 문서 형식 지원 |

**SMC와의 핵심 차이점:**

| 항목 | OpenYak | SMC (현재) | 시사점 |
|------|---------|-----------|--------|
| Desktop Framework | Tauri (Rust) | Electron (Node.js) | SMC는 Electron 내에서 구현 가능, Node.js 생태계 활용 |
| Frontend | Next.js + React | Vanilla HTML/CSS/JS | UI 복잡도 증가 시 프레임워크 도입 검토 필요 |
| Backend | 별도 Python 프로세스 | Electron Main Process | SMC는 Electron Main에서 직접 API 호출 가능 (별도 서버 불필요) |
| AI 접근 방식 | API 직접 호출 전용 | 웹뷰(BrowserView) 전용 | 하이브리드 접근이 SMC의 차별점 |
| DB | SQLite (async) | Electron Store (JSON) | 규모 확장 시 SQLite(better-sqlite3) 전환 필요 |

### A.2 Provider System 상세 분석

**소스 위치**: `references/desktop/backend/app/provider/`

#### A.2.1 Provider Registry 패턴

OpenYak은 21개 BYOK 프로바이더를 지원하며, `ProviderRegistry`를 통해 통합 관리한다:

```
ProviderRegistry
  ├── _providers: dict[str, BaseProvider]      # 활성 프로바이더 인스턴스
  ├── _model_index: dict[model_id, (provider, ModelInfo)]  # 모델 ID → 프로바이더 매핑
  └── _full_models: list[(provider, ModelInfo)] # 전체 모델 목록 (중복 포함)
```

**BaseProvider ABC 메서드:**
- `list_models()` → 사용 가능 모델 목록
- `stream_chat()` → LLM 스트리밍 응답
- `health_check()` → 프로바이더 상태 확인

**21개 Provider Catalog** (`catalog.py`):
```
openrouter, openai, anthropic, google, groq, deepseek, mistral, xai,
together, deepinfra, cerebras, cohere, perplexity, fireworks,
azure_openai, qwen, kimi, minimax, zhipu, siliconflow, xiaomi
```

각 프로바이더는 `ProviderDef`로 정의:
- `id`: 고유 식별자
- `name`: 표시 이름
- `settings_key`: 설정 파일의 API 키 필드명
- `kind`: 구현 유형 (`openai_compat` | `native_anthropic` | `native_gemini`)

**Provider 구현 계층:**
1. `OpenAICompatProvider` — OpenAI-compatible 기반 (대다수 프로바이더)
2. `AnthropicProvider` — Anthropic 네이티브 SDK
3. `GeminiProvider` — Google 네이티브 SDK
4. `OllamaProvider` — 로컬 LLM (바이너리 자동 다운로드/관리)
5. `OpenAISubscriptionProvider` — ChatGPT 구독 OAuth 연동

**SMC 적용 방안:**
- OpenAI-compatible 어댑터 패턴 채용 → 대다수 프로바이더를 단일 구현으로 커버
- Electron Main Process에서 Node.js SDK 직접 사용 (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`)
- 프로바이더 카탈로그는 JSON 설정 파일로 관리 (동적 추가 가능)

#### A.2.2 OAuth 플로우 상세 (`openai_oauth.py`, `mcp/oauth.py`)

```
1. generate_pkce_pair() → code_verifier + code_challenge (S256)
2. build_authorization_url() → auth.openai.com 리다이렉트
3. 사용자가 브라우저에서 인증 → callback URL 복사
4. exchange_code(code, code_verifier) → access_token + refresh_token
5. 토큰 저장: .openyak/mcp_tokens.json (만료 시각 포함)
6. refresh_token() → 만료 전 자동 갱신
```

#### A.2.3 모델 가격 메타데이터 (`models_dev.py`)

각 모델에 대해 가격 정보 유지:
- `input_price_per_1m`: 100만 input 토큰당 가격
- `output_price_per_1m`: 100만 output 토큰당 가격
- `context_window`: 컨텍스트 윈도우 크기
- `supports_tools`: 도구 호출 지원 여부
- `supports_vision`: 이미지 입력 지원 여부

### A.3 Session/Agent 실행 엔진 상세 분석

**소스 위치**: `references/desktop/backend/app/session/`, `references/desktop/backend/app/agent/`

#### A.3.1 핵심 실행 루프 (`processor.py`)

OpenYak의 핵심인 `SessionProcessor`는 다음 루프를 실행:

```
run_generation(session_id, prompt):
  1. 시스템 프롬프트 구축 (에이전트 + 스킬 + 메모리 주입)
  2. 메시지 히스토리 로드 (컨텍스트 압축 적용)
  3. Loop:
     a. LLM 스트리밍 호출
     b. 텍스트/추론/도구호출 파트 파싱
     c. 도구 호출 감지 시 → ToolContext.execute() (권한 확인 포함)
     d. 결과 DB 저장 (Message + Part)
     e. 도구 결과를 다음 LLM 호출의 입력으로
     f. 컨텍스트 한도 도달 시 → compaction (요약 압축)
  4. 완료 시 스트림 종료 이벤트 발행
```

#### A.3.2 4-Layer Permission 시스템 (`permission.py`)

```
Layer 1: Global defaults (settings.yaml)
Layer 2: Agent-level rules (에이전트별 허용 도구)
Layer 3: User permission presets (사용자 사전 설정)
Layer 4: Session-level overrides (세션별 임시 허용)

evaluate(ruleset, tool_name, file_path, workspace) → allowed: bool
```

도구 권한 분류:
- **읽기**: read, glob, grep, search → 기본 허용
- **쓰기**: write, edit → "Ask before edits" 모드에서 사용자 확인
- **실행**: bash, code_execute → 명시적 허용 필요
- **파일 경로 제한**: workspace 설정 시 해당 디렉토리 내에서만 허용

**SSE 이벤트 기반 권한 요청:**
```
Agent가 write 도구 호출 → ToolContext에서 권한 확인
→ 권한 없음 → PERMISSION_REQUEST SSE 이벤트 발행
→ 프론트엔드에서 다이얼로그 표시
→ 사용자 응답 → RespondRequest API 호출
→ Agent 계속 실행 또는 중단
```

#### A.3.3 에이전트 유형 (7가지)

| Agent | 용도 | 도구 |
|-------|------|------|
| general | 범용 채팅/작업 | 전체 도구 |
| build | 코드 작성/수정 | read, write, edit, bash, glob, grep |
| plan | 계획 수립 (파일 변경 없음) | read, glob, grep, search |
| explore | 코드베이스 탐색 | read, glob, grep |
| compaction | 컨텍스트 압축 | 없음 (LLM만) |
| title | 세션 제목 생성 | 없음 |
| summary | 요약 생성 | 없음 |

### A.4 Plugin/Skill/Connector 시스템 상세

**소스 위치**: `references/desktop/backend/app/plugin/`, `app/skill/`, `app/connector/`

#### A.4.1 Plugin 구조

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # 메타데이터 (name, version, description)
├── .mcp.json                # MCP 서버 설정 (커넥터 목록)
├── skills/
│   └── SKILL.md             # 각 스킬 정의 (YAML frontmatter + Markdown body)
└── CONNECTORS.md            # 필요 커넥터 설명
```

**Plugin 디스커버리 경로** (우선순위 순):
1. `app/data/plugins/` — 번들 플러그인 (Built-in)
2. `~/.openyak/plugins/` — 글로벌 사용자 플러그인
3. `./.openyak/plugins/`, `./.claude/` — 프로젝트별 플러그인

**PluginLoadResult 구조:**
```
PluginLoadResult:
  skills: list[SkillInfo]           # 스킬 목록
  mcp_servers: dict[name, config]   # MCP 서버 설정
  agents: list[AgentInfo]           # 에이전트 정의
  errors: list[str]                 # 로드 오류
  meta_map: dict[name, PluginMeta]  # 플러그인 메타
  mcp_by_plugin: dict[plugin, servers]  # 플러그인별 MCP 매핑
```

#### A.4.2 Skill 포맷

```markdown
---
name: "skill-name"
description: "What this skill does"
---

# Skill instructions and examples in Markdown
```

**디스커버리 경로** (낮은 → 높은 우선순위):
1. `app/data/skills/` — 번들 스킬
2. `~/.openyak/skills/` — 글로벌
3. `./.claude/skills/`, `./.agents/skills/` — 외부
4. `./.openyak/skills/` — 프로젝트

**활성화 관리**: `.openyak/skills.disabled.json` 파일에 비활성 스킬 ID 저장

#### A.4.3 Connector Registry 패턴

```
ConnectorRegistry:
  ├── McpManager 래핑 (실제 MCP 연결 관리)
  ├── 중복 제거: URL 기반(원격) / 이름 기반(로컬)
  ├── 플러그인별 MCP 트래킹 (동일 서버 재초기화 방지)
  ├── 활성화 상태: .openyak/connectors.json 영속화
  └── 도구 노출: ToolRegistry에 MCP 도구 등록
```

**MCP Client 전송 프로토콜:**
- `stdio`: 로컬 프로세스 기반 (Ollama, 로컬 도구)
- `sse`: Server-Sent Events 기반
- `http`: HTTP POST 기반

**Connector Catalog** (`connector/catalog.json`):
- 46개 사전 정의 커넥터 (Communication, Productivity, Developer Tools, Design, CRM, Analytics)
- 각 커넥터: id, name, url, category, description
- Custom 커넥터: 이름 + MCP URL 수동 등록

### A.5 Scheduler/Automation 시스템 상세

**소스 위치**: `references/desktop/backend/app/scheduler/`

#### A.5.1 TaskScheduler 엔진 (`engine.py`)

```
TaskScheduler:
  - 폴링 간격: 30초
  - 최대 동시 실행: 3개 태스크
  - 종료 타임아웃: 8초

  _poll_loop():
    while running:
      await asyncio.sleep(30)
      await _check_and_execute()  # next_run_at <= now인 태스크 실행

  _check_and_execute():
    tasks = query(next_run_at <= utcnow(), enabled=True)
    for task in tasks:
      if active_count < 3:
        asyncio.create_task(execute_scheduled_task(task.id))
        update task.next_run_at via croniter
```

#### A.5.2 ScheduledTask DB 모델

```sql
CREATE TABLE scheduled_task (
    id TEXT PRIMARY KEY,           -- ULID
    name TEXT,
    description TEXT,
    prompt TEXT,                    -- 실행할 프롬프트
    model_id TEXT,                 -- 사용할 모델
    schedule_config JSON,          -- { cron_expression, interval_seconds }
    workspace TEXT,                -- 작업 범위 제한
    next_run_at DATETIME,          -- 다음 실행 시각
    last_run_at DATETIME,
    enabled BOOL DEFAULT TRUE,
    triggered_by TEXT,             -- "schedule" | "manual"
    time_created DATETIME,
    time_updated DATETIME
);
```

#### A.5.3 자동화 실행 플로우 (`executor.py`)

```
execute_scheduled_task(task_id):
  1. DB에서 태스크 로드
  2. 새 세션 생성 (session_id)
  3. run_generation(session_id, task.prompt, model=task.model_id, workspace=task.workspace)
  4. 결과 저장 (session에 output 기록)
  5. 실행 상태 업데이트 (last_run_at, triggered_by)
```

### A.6 Remote Access 시스템 상세

**소스 위치**: `references/desktop/backend/app/auth/`

#### A.6.1 Cloudflare Tunnel 관리 (`tunnel.py`)

```
TunnelManager:
  - cloudflared 바이너리 자동 다운로드 (플랫폼별)
  - Quick Tunnel 모드 (Cloudflare 계정 불필요)
  - *.trycloudflare.com 임시 URL 할당
  - 서브프로세스 라이프사이클 관리 (start/stop/monitor)
  - 수동 터널 URL 대체 모드
```

#### A.6.2 인증 미들웨어 (`middleware.py`)

```
RemoteAuthMiddleware (Pure ASGI):
  - localhost 바이패스 (데스크톱 앱 직접 접근)
  - Bearer 토큰 검증 (JWT)
  - Rate limiting: 120 req/min/IP, 5 failed auth/min
  - SSE 스트리밍 호환 (응답 바디 버퍼링 없음)
  - 정적 파일 바이패스 (프론트엔드 에셋)
```

#### A.6.3 토큰 관리 (`token.py`)

- `data/remote_token.json`에 토큰 저장
- JWT 서명 검증
- Bearer 헤더 또는 쿼리 파라미터 (`?token=`) 지원

### A.7 Usage Tracking 시스템 상세

**소스 위치**: `references/desktop/backend/app/api/usage.py`

#### A.7.1 데이터 저장 전략

각 LLM 응답의 사용량을 `Message.data` JSON 컬럼에 저장:

```json
{
  "role": "assistant",
  "model": "gpt-5.4",
  "provider": "openai",
  "cost": 0.0015,
  "tokens": {
    "input": 1250,
    "output": 340,
    "reasoning": 0,
    "cache_read": 800,
    "cache_write": 450
  }
}
```

#### A.7.2 집계 쿼리 (`GET /api/usage?days=30`)

```sql
SELECT
  count(id),
  sum(json_extract(data, '$.cost')),
  sum(json_extract(data, '$.tokens.input')),
  sum(json_extract(data, '$.tokens.output')),
  sum(json_extract(data, '$.tokens.reasoning')),
  sum(json_extract(data, '$.tokens.cache_read')),
  sum(json_extract(data, '$.tokens.cache_write'))
FROM message
WHERE time_created >= :cutoff
GROUP BY json_extract(data, '$.provider'), json_extract(data, '$.model')
```

#### A.7.3 응답 타임 통계

Python `statistics` 모듈로 계산:
- avg, median, p95, min, max (메시지별 응답 시간)

### A.8 Frontend 핵심 패턴

**소스 위치**: `references/desktop/frontend/src/`

#### A.8.1 Zustand Store 구조

| Store | 역할 | 영속화 |
|-------|------|--------|
| `chat-store` | 활성 스트리밍, 파트 버퍼, 대기 메시지, 인터랙티브 프롬프트 | 없음 |
| `settings-store` | 모델/프로바이더 선택, 실행 모드, 권한 프리셋, 워크스페이스 | localStorage |
| `auth-store` | OpenYak 계정 토큰, 프로필 | localStorage |
| `activity-store` | Activity 패널 (도구 실행 타임라인) | 없음 |
| `artifact-store` | Artifact 패널 (미리보기, 버전 관리) | 없음 |
| `workspace-store` | 워크스페이스 (할일, 파일, 메모리) | 없음 |

#### A.8.2 SSE 스트리밍 패턴 (`use-sse.ts`)

```
1. POST /api/chat/prompt → { stream_id, session_id }
2. GET /api/chat/stream/{stream_id}?last_event_id=N → SSE EventSource
3. 이벤트 타입: text_delta, reasoning_delta, tool_call, tool_result,
                step_start, step_end, compaction, permission_request, done
4. 재연결: last_event_id로 누락 이벤트 복구
```

#### A.8.3 패널 상호 배제

Activity, Artifact, PlanReview 3개 우측 패널은 상호 배타적:
- Activity 열기 → Artifact/PlanReview 닫기
- Artifact 열기 → Activity/PlanReview 닫기
- 동시 열림 방지로 화면 공간 관리

### A.9 Desktop Layer (Tauri) 핵심 패턴

**소스 위치**: `references/desktop/desktop-tauri/src-tauri/`

#### A.9.1 백엔드 프로세스 관리 (`backend.rs`)

```
Tauri App
  └── BackendState (관리 상태)
      ├── 포트 할당: portpicker로 랜덤 미사용 포트
      ├── 프로세스 시작: PyInstaller 바이너리 실행
      ├── 헬스체크: /livez 엔드포인트 폴링 (500ms × 60회 = 30초)
      ├── Watchdog: 10초 간격 헬스체크
      ├── Exit Monitor: 2초 간격 프로세스 상태 감시
      ├── 크래시 복구: 지수 백오프 (1s→2s→4s), 60초 내 최대 3회
      └── 정상 종료: POST /shutdown → 12초 대기 → 강제 종료(taskkill)
```

#### A.9.2 SMC Electron과의 매핑

| Tauri 패턴 | SMC Electron 대응 | 구현 난이도 |
|-----------|-------------------|-----------|
| `get_backend_url` IPC | Electron IPC `ipcMain.handle` | 낮음 |
| PyInstaller 바이너리 실행 | Node.js에서 직접 실행 (별도 서버 불필요) | 해당 없음 |
| Cloudflared 서브프로세스 | `child_process.spawn('cloudflared')` | 중간 |
| CSP 정책 | `webPreferences.contentSecurityPolicy` | 낮음 |
| 창 상태 관리 | `electron-window-state` (이미 유사 구현) | 낮음 |
| 자동 업데이트 | `electron-updater` (이미 구현) | 해당 없음 |
| 시스템 트레이 | `Tray` API (구현 필요) | 낮음 |

---

## 3. 요구사항 정의

### 3.1 Feature 1: BYOK (Bring Your Own Key) Provider System

#### 3.1.1 핵심 목표
SMC가 기존 웹뷰 기반 접근 외에, 사용자의 API 키를 통해 직접 AI 모델에 접근하는 이중 채널 구조를 갖춘다.

#### 3.1.2 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| BYOK-001 | Provider 설정 UI | P0 | API 키 입력, 저장, 검증, 활성화/비활성화 |
| BYOK-002 | Multi-Provider 지원 | P0 | OpenAI, Anthropic, Google AI, xAI, Ollama 등 복수 프로바이더 동시 등록 |
| BYOK-003 | 모델 선택 | P0 | 프로바이더별 사용 가능 모델 목록 조회 및 선택 |
| BYOK-004 | API 키 보안 저장 | P0 | Electron safeStorage 또는 OS keychain을 통한 암호화 저장 |
| BYOK-005 | 웹뷰/API 하이브리드 모드 | P1 | 동일 AI 서비스에 대해 웹뷰 패널과 API 패널을 동시 운용 |
| BYOK-006 | OAuth 기반 인증 | P2 | ChatGPT Subscription 같은 OAuth 플로우 지원 |
| BYOK-007 | Ollama 로컬 모델 | P2 | localhost에서 구동되는 Ollama 모델 연결 |
| BYOK-008 | 연결 상태 모니터링 | P1 | API 키 유효성, 남은 크레딧, rate limit 상태 표시 |

#### 3.1.3 SMC 차별화 포인트
- **동일 프롬프트의 웹뷰 vs API 결과 비교**: 웹뷰(구독 기반)와 API(키 기반)의 응답을 나란히 비교
- **교차 프로바이더 비교**: OpenAI API + Claude API + Gemini API 동시 호출 → 순수 API 기반 교차검증
- **비용 최적화**: API 비용 실시간 추적으로 가성비 높은 AI 선택 지원

### 3.2 Feature 2: Agent/Codex 실행 엔진

#### 3.2.1 핵심 목표
교차검증으로 확인된 결과를 실제 작업(파일 생성, 코드 작성, 데이터 처리 등)으로 실행하는 에이전트 환경을 제공한다.

#### 3.2.2 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| AGENT-001 | 실행 모드 UI | P0 | Plan/Ask before edits/Edit automatically 3단계 모드 |
| AGENT-002 | 파일 시스템 접근 | P0 | 사용자 지정 워크스페이스 폴더 내 파일 읽기/쓰기 |
| AGENT-003 | 교차검증 컨텍스트 주입 | P0 | SMC 교차검증 결과를 에이전트 실행 컨텍스트로 전달 |
| AGENT-004 | 작업 실행 샌드박스 | P0 | 에이전트 작업의 격리 실행 (파일 변경 롤백 가능) |
| AGENT-005 | 빠른 작업 템플릿 | P1 | Summarize folder, Data Extraction 등 원클릭 액션 |
| AGENT-006 | 실행 결과 미리보기 | P1 | 파일 변경 전 diff 표시, 사용자 승인 후 적용 |
| AGENT-007 | 실행 이력 관리 | P1 | 에이전트 실행 로그, 생성된 파일, 변경 사항 추적 |
| AGENT-008 | 다중 AI 에이전트 비교 실행 | P2 | 동일 작업을 여러 AI 에이전트로 실행 후 결과 비교 |

#### 3.2.3 "Cross-Verify → Execute" 파이프라인

```
[SMC 교차검증]                    [Agent 실행]

 ChatGPT ──┐
 Claude  ──┼──→ 교차검증 결과 ──→ 최선 답변 선택 ──→ 실행 모드 선택 ──→ 작업 실행
 Gemini  ──┘    (합의/불일치)      (수동/AI추천)     (Plan/Ask/Auto)    (파일/코드/데이터)
                                                                        │
                                                                        ▼
                                                                    결과물 생성
                                                                  (보고서/코드/문서)
```

### 3.3 Feature 3: Plugins, Skills, Connectors 시스템

#### 3.3.1 핵심 목표
SMC의 기능을 모듈화하여 도메인별 워크플로우를 패키징하고, 외부 서비스와의 연동을 표준화한다.

#### 3.3.2 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| PLUG-001 | Connectors 관리 UI | P1 | 외부 서비스 연결 (MCP 프로토콜 기반) |
| PLUG-002 | Custom Connector 추가 | P1 | Name + MCP URL로 사용자 정의 커넥터 등록 |
| PLUG-003 | Skills 카탈로그 | P1 | 내장 스킬 목록, 검색, 활성화/비활성화 |
| PLUG-004 | Plugins 번들 | P2 | Skills + Connectors 묶음, 도메인별 패키지 |
| PLUG-005 | Plugin 마켓플레이스 | P3 | 커뮤니티 제작 플러그인 배포/설치 |

#### 3.3.3 SMC 특화 Skills (초기 내장)

| Skill | 설명 | 교차검증 연계 |
|-------|------|-------------|
| cross-verify-report | 교차검증 결과를 구조화된 보고서로 생성 | 합의/불일치 영역 자동 하이라이트 |
| consensus-extract | 다수 AI가 동의하는 핵심 팩트 추출 | 합의도 점수 기반 필터링 |
| discrepancy-analysis | AI 간 불일치 분석 및 추가 검증 제안 | 자동 후속 질문 생성 |
| data-to-spreadsheet | 교차검증된 데이터를 Excel/CSV로 변환 | 구조화된 데이터 추출 |
| prompt-optimizer | 교차검증 결과 기반 프롬프트 개선 제안 | A/B 프롬프트 비교 |
| meeting-summary | 대화 내용을 회의록 형태로 정리 | 다중 AI 의견 종합 |

### 3.4 Feature 4: Automations

#### 3.4.1 핵심 목표
반복적인 교차검증 및 후속 작업을 자동화하여 정기적인 인사이트를 생성한다.

#### 3.4.2 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| AUTO-001 | 자동화 CRUD UI | P2 | 생성, 편집, 삭제, 활성화/비활성화 |
| AUTO-002 | 스케줄 설정 | P2 | Scheduled(요일/시간) + Interval(N분/시간 간격) |
| AUTO-003 | 템플릿 라이브러리 | P2 | 사전 정의 자동화 템플릿 |
| AUTO-004 | 프롬프트 + AI 선택 | P2 | 자동화별 프롬프트, 대상 AI 서비스, 교차검증 여부 설정 |
| AUTO-005 | 결과 알림 | P2 | 자동화 완료 시 시스템 알림 또는 이메일 |
| AUTO-006 | 워크스페이스 스코핑 | P3 | 프로젝트별 자동화 격리 |

#### 3.4.3 SMC 특화 자동화 시나리오

| 시나리오 | 설명 | 주기 |
|---------|------|------|
| Daily Trend Watch | 특정 주제를 3개 AI에 질문, 트렌드 변화 추적 | Daily 08:00 |
| Weekly AI Benchmark | 동일 벤치마크 프롬프트로 AI 성능 비교 | Weekly |
| Competitor Monitor | 경쟁사/기술 동향을 교차검증으로 확인 | Weekdays |
| Prompt Quality Check | 저장된 프롬프트의 최신 유효성 검증 | Monthly |

### 3.5 Feature 5: Usage Monitor & Cost Tracking

#### 3.5.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| USAGE-001 | 토큰 사용량 추적 | P1 | API 호출별 input/output/reasoning 토큰 기록 |
| USAGE-002 | 비용 계산 | P1 | 프로바이더별 가격 모델 기반 비용 산출 |
| USAGE-003 | 일별/주별/월별 트렌드 | P1 | 사용량 추세 차트 |
| USAGE-004 | 모델별 사용 비교 | P1 | 어떤 모델이 가장 효율적인지 분석 |
| USAGE-005 | 세션별 소비 상세 | P2 | Top Sessions, 세션당 토큰/비용 |
| USAGE-006 | 예산 알림 | P2 | 설정된 예산 초과 시 경고 |

### 3.6 Feature 6: Remote Access

#### 3.6.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| REMOTE-001 | 터널 기반 원격 접근 | P3 | Cloudflare Tunnel 또는 유사 서비스 |
| REMOTE-002 | QR 코드 + 토큰 인증 | P3 | 모바일 간편 연결 |
| REMOTE-003 | Permission Mode | P3 | 원격 실행 권한 3단계 설정 |
| REMOTE-004 | 결과 스트리밍 | P3 | 데스크톱 실행 → 모바일로 결과 전송 |

---

## 4. 기술적 검토 및 구현 방안

### 4.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Sync Multi Chat v2.0                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │  WebView Layer   │  │   API Layer     │  │   Agent Layer      │  │
│  │  (기존 방식)      │  │   (BYOK 신규)   │  │   (실행 엔진)      │  │
│  │                  │  │                 │  │                    │  │
│  │  ChatGPT  ─┐    │  │  OpenAI API ─┐  │  │  Task Executor  ──┤  │
│  │  Claude   ─┤    │  │  Claude API ─┤  │  │  File Manager   ──┤  │
│  │  Gemini   ─┤    │  │  Gemini API ─┤  │  │  Sandbox        ──┤  │
│  │  Grok     ─┤    │  │  xAI API    ─┤  │  │  Diff Viewer    ──┤  │
│  │  Perplexity┤    │  │  Ollama     ─┤  │  │  Rollback       ──┤  │
│  │  Genspark ─┘    │  │  Custom MCP ─┘  │  │                    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬───────────┘  │
│           │                    │                     │              │
│           └──────────┬─────────┘                     │              │
│                      ▼                               │              │
│           ┌─────────────────────┐                    │              │
│           │  Cross-Verify Hub   │────────────────────┘              │
│           │  (교차검증 엔진)      │                                   │
│           │                     │                                   │
│           │  - 합의 분석         │                                   │
│           │  - 불일치 감지       │                                   │
│           │  - 신뢰도 점수       │                                   │
│           │  - 최선 답변 추천     │                                   │
│           └─────────────────────┘                                   │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Plugins    │  │  Automations │  │  Usage Monitor & Remote    │ │
│  │  Skills     │  │  Scheduler   │  │  Access                    │ │
│  │  Connectors │  │  Templates   │  │                            │ │
│  └─────────────┘  └──────────────┘  └────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Electron Main Process | IPC | Electron Store | OS Keychain         │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 BYOK Provider System 구현 방안

> OpenYak 소스 코드 분석 기반으로 구체화 (참조: Appendix A.2)

#### 4.2.1 기술 스택 및 패키지 선정

**API 클라이언트 (Electron Main Process에서 실행):**

| 프로바이더 | npm 패키지 | 프로토콜 | 비고 |
|-----------|-----------|---------|------|
| OpenAI | `openai` | Chat Completions API | GPT-5.x, o-series |
| Anthropic | `@anthropic-ai/sdk` | Messages API | Claude 계열 |
| Google | `@google/generative-ai` | Gemini API | Gemini 계열 |
| xAI | `openai` (호환) | OpenAI-compatible | Grok 계열, baseURL만 변경 |
| Groq | `openai` (호환) | OpenAI-compatible | 고속 추론 |
| DeepSeek | `openai` (호환) | OpenAI-compatible | DeepSeek-V3/R1 |
| Ollama | 직접 HTTP (`fetch`) | REST API (localhost:11434) | 로컬 모델 |
| OpenRouter | `openai` (호환) | OpenAI-compatible | 멀티 프로바이더 프록시 |

**OpenYak 인사이트**: 21개 프로바이더 중 대다수가 `OpenAICompatProvider`로 구현됨. SMC도 OpenAI-compatible 어댑터 하나로 xAI, Groq, DeepSeek, Together, Fireworks 등을 모두 커버 가능.

**키 저장:**
- `electron.safeStorage.encryptString(apiKey)` → 암호화된 버퍼
- `electron-store`에 암호화된 값 저장
- `safeStorage.decryptString(buffer)` → 런타임에서만 복호화

**모델 목록:**
- 각 프로바이더 API의 `/v1/models` 엔드포인트 호출
- OpenYak의 `models_dev.py`처럼 정적 가격/능력 메타데이터 JSON 파일 유지
- 동적 모델 목록 + 정적 메타데이터 병합

#### 4.2.2 Provider Registry 패턴 (OpenYak 패턴 적용)

OpenYak의 `ProviderRegistry` 패턴을 Node.js/Electron에 적용:

```javascript
// src/main/providers/registry.js
class ProviderRegistry {
  // 프로바이더 카탈로그 (JSON 기반, 동적 추가 가능)
  static CATALOG = [
    { id: 'openai', name: 'OpenAI', kind: 'native', settingsKey: 'openai_api_key' },
    { id: 'anthropic', name: 'Anthropic', kind: 'native', settingsKey: 'anthropic_api_key' },
    { id: 'google', name: 'Google AI', kind: 'native', settingsKey: 'google_api_key' },
    { id: 'xai', name: 'xAI', kind: 'openai_compat', settingsKey: 'xai_api_key',
      baseUrl: 'https://api.x.ai/v1' },
    { id: 'groq', name: 'Groq', kind: 'openai_compat', settingsKey: 'groq_api_key',
      baseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'deepseek', name: 'DeepSeek', kind: 'openai_compat', settingsKey: 'deepseek_api_key',
      baseUrl: 'https://api.deepseek.com/v1' },
    { id: 'ollama', name: 'Ollama', kind: 'local', baseUrl: 'http://localhost:11434' },
    { id: 'openrouter', name: 'OpenRouter', kind: 'openai_compat', settingsKey: 'openrouter_api_key',
      baseUrl: 'https://openrouter.ai/api/v1' },
  ];

  constructor() {
    this._providers = new Map();     // id → BaseProvider
    this._modelIndex = new Map();    // model_id → { provider, modelInfo }
  }

  // API 키가 설정된 프로바이더만 활성화
  async initialize(settings) { /* ... */ }

  // 모든 프로바이더에서 모델 목록 수집
  async refreshModels() { /* ... */ }

  // model_id로 프로바이더 찾기
  resolveModel(modelId) { /* ... */ }

  // 스트리밍 채팅 호출
  async *streamChat(modelId, messages, options) { /* ... */ }
}
```

```javascript
// src/main/providers/base.js
class BaseProvider {
  async listModels() { throw new Error('Not implemented'); }
  async *streamChat(model, messages, options) { throw new Error('Not implemented'); }
  async healthCheck() { throw new Error('Not implemented'); }
  async validateKey() { throw new Error('Not implemented'); }
}

// OpenAI-compatible 어댑터 (대다수 프로바이더 커버)
class OpenAICompatProvider extends BaseProvider {
  constructor(apiKey, baseUrl, providerDef) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.def = providerDef;
  }

  async *streamChat(model, messages, options) {
    const stream = await this.client.chat.completions.create({
      model, messages, stream: true, ...options
    });
    for await (const chunk of stream) {
      yield { type: 'text_delta', content: chunk.choices[0]?.delta?.content || '' };
    }
  }
}
```

#### 4.2.3 웹뷰-API 하이브리드 패널

현재 SMC의 BrowserView 기반 패널에 API 기반 패널을 추가:

**패널 유형 구분:**
```
PanelType:
  ├── "webview"  — 기존 BrowserView (Puppeteer 자동화, 사용자 구독 활용)
  ├── "api"      — BYOK 방식 (직접 API 호출, 자체 Markdown 렌더링)
  └── "hybrid"   — 동일 AI에 대해 웹뷰+API 분할 비교
```

**API Panel 구현 방식:**
- BrowserView 대신 Electron의 `webContents`에 자체 HTML 로드
- 기존 Marked + Highlight.js + KaTeX + Mermaid 렌더링 파이프라인 재활용
- IPC를 통해 Main Process(API 호출) ↔ Renderer(UI 표시) 통신
- 스트리밍 응답은 Main → Renderer로 청크 단위 IPC 전송

**SMC 고유 하이브리드 시나리오:**
```
┌──────────────────────────────────────────────────────┐
│  SMC 메인 윈도우                                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ ChatGPT  │  │ Claude   │  │ Gemini   │  WebView  │
│  │ (웹뷰)   │  │ (웹뷰)   │  │ (웹뷰)   │  Layer    │
│  │ 구독 기반  │  │ 구독 기반  │  │ 구독 기반  │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ GPT-5.4  │  │ Claude4  │  │ Gemini2  │  API      │
│  │ (API)    │  │ (API)    │  │ (API)    │  Layer    │
│  │ BYOK 기반 │  │ BYOK 기반 │  │ BYOK 기반 │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│  [교차검증: 6개 응답 비교 (웹뷰 3 + API 3)]            │
└──────────────────────────────────────────────────────┘
```

### 4.3 Agent 실행 엔진 구현 방안

> OpenYak의 SessionProcessor + Permission 시스템을 참조 (Appendix A.3)

#### 4.3.1 실행 모드 아키텍처 (OpenYak 4-Layer Permission 적용)

OpenYak의 Permission 시스템을 SMC에 적용하되, SMC의 교차검증 맥락에 맞게 확장:

```
┌──────────────────────────────────────────────────────────┐
│              SMC Agent Execution Engine                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  입력: 교차검증 결과 + 사용자 지시                        │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────────────────┐        │
│  │  Permission Evaluation (OpenYak 4-Layer 적용)  │        │
│  │                                              │        │
│  │  L1: Global defaults (settings)              │        │
│  │  L2: 작업 유형별 규칙 (보고서/코드/데이터)     │        │
│  │  L3: 사용자 사전 설정 (프리셋)                │        │
│  │  L4: 세션별 임시 허용                         │        │
│  └──────────────────────────────────────────────┘        │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Plan Mode  │  │ Ask Before Edit │  │  Auto Edit   │ │
│  │  읽기 도구만 │  │  쓰기 시 확인   │  │  자동 실행    │ │
│  │  read, glob │  │  + diff 미리보기 │  │  + 자동 백업  │ │
│  │  grep       │  │  + 사용자 승인   │  │  workspace내 │ │
│  └─────────────┘  └─────────────────┘  └──────────────┘ │
│                                                          │
│  도구 분류 (OpenYak 패턴):                                │
│  - 읽기: file_read, glob, grep → 기본 허용               │
│  - 쓰기: file_write, file_edit → 모드에 따라 확인        │
│  - 실행: shell_exec → 명시적 허용 필요                    │
│  - 파일 경로: workspace 범위 내로 제한                    │
└──────────────────────────────────────────────────────────┘
```

#### 4.3.2 도구 시스템 (OpenYak ToolRegistry 참조)

OpenYak은 20+ 내장 도구를 `ToolRegistry`로 관리. SMC Agent에 필요한 도구:

| 도구 | 분류 | 기능 | 권한 |
|------|------|------|------|
| `file_read` | 읽기 | 파일 내용 읽기 | 기본 허용 |
| `file_write` | 쓰기 | 파일 생성/덮어쓰기 | Ask/Auto |
| `file_edit` | 쓰기 | 파일 부분 수정 (diff 기반) | Ask/Auto |
| `glob` | 읽기 | 파일 패턴 검색 | 기본 허용 |
| `grep` | 읽기 | 파일 내용 검색 | 기본 허용 |
| `shell_exec` | 실행 | 셸 명령 실행 (Node.js child_process) | 명시적 허용 |
| `web_search` | 읽기 | 웹 검색 | 기본 허용 |

**구현 참조**: OpenYak `app/tool/builtin/` 디렉토리의 각 도구 구현 패턴

#### 4.3.3 샌드박스 구현

OpenYak의 `ToolContext` + workspace 제한 패턴 적용:

```javascript
class ToolContext {
  constructor(workspace, permissionMode, permissionRules) {
    this.workspace = workspace;         // 작업 허용 디렉토리
    this.mode = permissionMode;         // 'plan' | 'ask' | 'auto'
    this.rules = permissionRules;       // 4-layer 평가 규칙
    this.changeLog = [];                // 변경 이력 (롤백용)
  }

  async execute(toolName, args) {
    // 1. 파일 경로가 workspace 내인지 검증
    if (args.path && !this.isWithinWorkspace(args.path)) {
      throw new PermissionError('Outside workspace');
    }

    // 2. 권한 평가 (4-layer)
    const allowed = this.evaluatePermission(toolName, args.path);
    if (!allowed && this.mode === 'ask') {
      // IPC로 렌더러에 권한 요청 다이얼로그 표시
      const approved = await this.requestUserPermission(toolName, args);
      if (!approved) throw new PermissionError('User denied');
    }

    // 3. 실행 전 스냅샷 (쓰기 도구의 경우)
    if (this.isWriteTool(toolName)) {
      this.changeLog.push({ tool: toolName, args, snapshot: await this.snapshot(args.path) });
    }

    // 4. 도구 실행
    return await this.tools[toolName].execute(args);
  }

  async rollback() {
    // changeLog 역순으로 복원
    for (const entry of this.changeLog.reverse()) {
      await this.restore(entry.args.path, entry.snapshot);
    }
  }
}
```

#### 4.3.4 교차검증 컨텍스트 전달

교차검증 결과에서 에이전트로 전달되는 데이터 구조:

```javascript
// 교차검증 결과 → Agent 시스템 프롬프트에 주입
const crossVerifyContext = {
  originalPrompt: "원본 프롬프트",
  responses: [
    { provider: "chatgpt", model: "gpt-5.4", content: "...", source: "webview" },
    { provider: "claude", model: "claude-opus-4", content: "...", source: "webview" },
    { provider: "gemini", model: "gemini-2.5-pro", content: "...", source: "api" },
  ],
  consensus: {
    agreed: ["핵심 팩트 1", "핵심 팩트 2"],
    confidence: 0.87,
  },
  discrepancies: [
    { topic: "불일치 영역", positions: { chatgpt: "...", claude: "..." } }
  ],
  selectedBest: "claude",           // 사용자가 선택한 최선 답변
  userInstruction: "이 결과를 바탕으로 요약 보고서를 작성해줘",
};
```

**시스템 프롬프트 구성** (OpenYak `system_prompt.py` 패턴 적용):
```
[Agent 역할 정의]
+ [활성 스킬 주입]
+ [교차검증 컨텍스트 (위 JSON)]
+ [사용자 지시]
+ [워크스페이스 정보]
+ [도구 목록]
```

### 4.4 Plugins/Skills/Connectors 구현 방안

> OpenYak의 Plugin/Skill/Connector 시스템 직접 참조 (Appendix A.4)

#### 4.4.1 MCP(Model Context Protocol) 기반 Connectors

OpenYak의 `ConnectorRegistry` + `McpManager` 패턴을 Node.js로 포팅:

**MCP Client 구현 (Node.js):**
```javascript
// @modelcontextprotocol/sdk 패키지 활용
const { Client } = require('@modelcontextprotocol/sdk/client');

class McpConnector {
  constructor(name, config) {
    this.name = name;
    this.transport = config.transport; // 'stdio' | 'sse' | 'http'
    this.url = config.url;
    this.client = null;
  }

  async connect() {
    // OpenYak의 McpClient.connect() 패턴
    this.client = new Client({ name: this.name });
    await this.client.connect(this.createTransport());
  }

  async listTools() {
    return await this.client.listTools();
  }

  async callTool(toolName, args) {
    return await this.client.callTool({ name: toolName, arguments: args });
  }
}
```

**Connector Registry:**
```javascript
class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();        // id → McpConnector
    this.catalog = require('./catalog.json');  // 사전 정의 커넥터 목록
    this.customPath = path.join(app.getPath('userData'), 'connectors.json');
  }

  // OpenYak 패턴: URL 기반 중복 제거
  async registerFromPlugin(plugin) { /* ... */ }

  // Custom connector 등록 (Name + MCP URL)
  async addCustom(name, url) { /* ... */ }

  // 모든 MCP 도구를 ToolRegistry에 노출
  getTools() {
    return Array.from(this.connectors.values())
      .filter(c => c.enabled)
      .flatMap(c => c.tools.map(t => ({
        name: `${c.name}_${t.name}`,  // OpenYak의 sanitized tool ID 패턴
        description: t.description,
        inputSchema: t.inputSchema,
        connector: c.name,
      })));
  }
}
```

**사전 정의 커넥터 카탈로그** (OpenYak의 `catalog.json` 참조, 46개):
```json
{
  "communication": [
    { "id": "slack", "name": "Slack", "category": "communication" }
  ],
  "productivity": [
    { "id": "notion", "name": "Notion", "category": "productivity" },
    { "id": "google-workspace", "name": "Google Workspace", "category": "productivity" },
    { "id": "linear", "name": "Linear", "category": "productivity" }
  ],
  "developer": [
    { "id": "github", "name": "GitHub", "category": "developer" },
    { "id": "atlassian", "name": "Atlassian", "category": "developer" }
  ]
}
```

#### 4.4.2 Skills 시스템 (SKILL.md 포맷)

OpenYak과 동일한 SKILL.md 포맷 채용:

```markdown
---
name: "cross-verify-report"
description: "교차검증 결과를 구조화된 보고서로 생성"
---

# Cross-Verify Report Generator

당신은 여러 AI의 교차검증 결과를 분석하여 구조화된 보고서를 생성하는 전문가입니다.

## 입력 형식
교차검증 컨텍스트가 시스템 프롬프트에 포함됩니다.

## 출력 형식
1. 합의 영역 (모든 AI가 동의)
2. 불일치 영역 (AI 간 의견 차이)
3. 신뢰도 평가
4. 권장 후속 조치
```

**Skill Discovery 경로** (OpenYak 패턴, 우선순위 순):
```
1. app.asar/skills/           → 번들 스킬 (Built-in)
2. ~/.smc/skills/             → 글로벌 사용자 스킬
3. ./.smc/skills/             → 프로젝트별 스킬
```

**Skill Registry:**
```javascript
class SkillRegistry {
  constructor() {
    this.skills = new Map();
    this.disabledPath = path.join(app.getPath('userData'), 'skills.disabled.json');
  }

  // SKILL.md 파싱: YAML frontmatter + Markdown body
  parseSkillFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data: meta, content: body } = matter(content); // gray-matter 패키지
    return { name: meta.name, description: meta.description, content: body, location: filePath };
  }

  // 디스커버리 경로 순회
  async discover() { /* ... */ }

  // 활성 스킬을 시스템 프롬프트에 주입
  getActiveSkillsPrompt() {
    return Array.from(this.skills.values())
      .filter(s => !this.disabled.has(s.name))
      .map(s => `## Skill: ${s.name}\n${s.content}`)
      .join('\n\n');
  }
}
```

#### 4.4.3 Plugin = Skills + Connectors 번들

OpenYak의 Plugin 디렉토리 구조를 그대로 채용:

```
smc-plugin-research/
├── plugin.json               # 메타데이터
│   {
│     "name": "research",
│     "version": "1.0.0",
│     "description": "교차검증 기반 리서치 워크플로우",
│     "skills": ["cross-verify-report", "consensus-extract"],
│     "connectors": ["google-workspace", "notion"]
│   }
├── skills/
│   ├── cross-verify-report/
│   │   └── SKILL.md
│   └── consensus-extract/
│       └── SKILL.md
└── mcp.json                  # 필요 MCP 서버 설정
```

**Plugin Manager** (OpenYak `PluginManager` 패턴):
- 활성화/비활성화 토글 → `.smc/plugins.disabled.json` 영속화
- 활성화 시 필요 Connectors 자동 안내
- 플러그인별 MCP 서버 트래킹 (중복 연결 방지)

### 4.5 Automations 구현 방안

> OpenYak의 TaskScheduler 엔진 직접 참조 (Appendix A.5)

#### 4.5.1 스케줄러 아키텍처 (OpenYak 패턴 적용)

OpenYak의 `TaskScheduler` 패턴을 Node.js로 구현:

```javascript
// src/main/scheduler/engine.js
class TaskScheduler {
  constructor(store) {
    this.store = store;                // Electron Store 또는 SQLite
    this.running = false;
    this.activeJobs = new Map();
    this.MAX_CONCURRENT = 3;           // OpenYak과 동일
    this.POLL_INTERVAL = 30_000;       // 30초 간격 (OpenYak과 동일)
  }

  async start() {
    this.running = true;
    this._pollLoop();
  }

  async stop() {
    this.running = false;
    // 활성 작업 대기 (최대 8초, OpenYak과 동일)
    await Promise.race([
      Promise.all(Array.from(this.activeJobs.values())),
      new Promise(r => setTimeout(r, 8000))
    ]);
  }

  async _pollLoop() {
    while (this.running) {
      await this._checkAndExecute();
      await new Promise(r => setTimeout(r, this.POLL_INTERVAL));
    }
  }

  async _checkAndExecute() {
    const now = new Date();
    const dueTasks = this.store.getTasks()
      .filter(t => t.enabled && new Date(t.nextRunAt) <= now);

    for (const task of dueTasks) {
      if (this.activeJobs.size >= this.MAX_CONCURRENT) break;

      const job = this._executeTask(task);
      this.activeJobs.set(task.id, job);
      job.finally(() => this.activeJobs.delete(task.id));

      // croniter 패턴: 다음 실행 시각 계산
      task.nextRunAt = this._computeNextRun(task.scheduleConfig);
      this.store.updateTask(task);
    }
  }

  async _executeTask(task) {
    // SMC 특화: 다중 AI 교차검증 자동 실행
    const results = await Promise.allSettled(
      task.targetProviders.map(provider =>
        this.providerRegistry.streamChat(provider.modelId, [
          { role: 'user', content: task.prompt }
        ])
      )
    );
    // 결과 저장 + 알림
    await this.store.saveAutomationResult(task.id, results);
    this._notifyCompletion(task, results);
  }
}
```

**npm 패키지:**
- `croner` (경량 cron 스케줄러, croniter 대안) 또는 `node-cron`
- 앱이 실행 중일 때만 동작 → 시스템 트레이 상주 모드 지원

#### 4.5.2 자동화 데이터 모델

OpenYak의 `ScheduledTask` 스키마를 SMC에 적용:

```javascript
const automationSchema = {
  id: 'ulid',
  name: 'string',
  description: 'string',
  prompt: 'string',                    // 실행할 프롬프트
  scheduleConfig: {
    type: 'scheduled' | 'interval',
    cronExpression: 'string',          // e.g., "0 8 * * 1-5"
    intervalSeconds: 'number',         // e.g., 3600
  },
  targetProviders: [{                   // SMC 고유: 다중 AI 대상
    providerId: 'string',
    modelId: 'string',
    source: 'webview' | 'api',
  }],
  crossVerify: 'boolean',              // SMC 고유: 교차검증 실행 여부
  workspace: 'string | null',          // 작업 범위 제한
  nextRunAt: 'datetime',
  lastRunAt: 'datetime',
  enabled: 'boolean',
};
```

#### 4.5.3 SMC 특화 자동화 실행 플로우

```
Schedule Trigger
  → 프롬프트를 N개 AI에 동시 전송 (웹뷰 + API 혼합 가능)
  → 응답 수집 및 대기
  → crossVerify === true ? 교차검증 분석 실행 : 결과 직접 저장
  → 결과 저장 (Electron Store 또는 SQLite)
  → 시스템 알림 (Electron Notification API)
  → 선택적: 후속 Agent 실행 (보고서 생성 등)
```

### 4.6 Usage Monitor 구현 방안

> OpenYak의 Usage Tracking 전략 직접 참조 (Appendix A.7)

#### 4.6.1 데이터 저장 전략 (OpenYak 패턴)

OpenYak은 `Message.data` JSON 컬럼에 토큰/비용을 저장. SMC는 Electron Store에서 시작, 규모 확장 시 SQLite 전환:

**Phase 1 - Electron Store:**
```javascript
// 각 API 호출 결과에 usage 메타데이터 첨부
const usageEntry = {
  id: generateUlid(),
  timestamp: new Date().toISOString(),
  provider: 'openai',
  model: 'gpt-5.4',
  source: 'api',                    // 'api' | 'webview' (웹뷰는 추적 불가로 null)
  tokens: {
    input: 1250,
    output: 340,
    reasoning: 0,
    cache_read: 800,
    cache_write: 450,
  },
  cost: 0.0015,                     // 프로바이더 가격표 기반 계산
  responseTime: 1.23,               // 초
  sessionId: 'session_xxx',
};
```

**Phase 2 - SQLite (better-sqlite3):**
```sql
CREATE TABLE usage (
    id TEXT PRIMARY KEY,
    timestamp DATETIME,
    provider TEXT,
    model TEXT,
    source TEXT,              -- 'api' | 'webview'
    tokens_input INTEGER,
    tokens_output INTEGER,
    tokens_reasoning INTEGER,
    cost REAL,
    response_time REAL,
    session_id TEXT
);

-- OpenYak 스타일 집계 쿼리
CREATE INDEX idx_usage_timestamp ON usage(timestamp);
CREATE INDEX idx_usage_provider ON usage(provider, model);
```

#### 4.6.2 가격 모델 관리

OpenYak의 `models_dev.py` 패턴 적용:
```javascript
// src/main/providers/pricing.json
{
  "openai": {
    "gpt-5.4": { "input_per_1m": 2.50, "output_per_1m": 10.00 },
    "gpt-5.3-codex": { "input_per_1m": 2.00, "output_per_1m": 8.00 }
  },
  "anthropic": {
    "claude-opus-4": { "input_per_1m": 15.00, "output_per_1m": 75.00 },
    "claude-sonnet-4": { "input_per_1m": 3.00, "output_per_1m": 15.00 }
  }
}
```

#### 4.6.3 SMC 고유: 다중 AI 비용 비교 대시보드

```
┌─────────────────────────────────────────────────────────┐
│  Usage Monitor - Cross-Provider Comparison               │
│                                                         │
│  동일 프롬프트 비용 비교 (최근 30일)                      │
│  ┌───────────┬────────┬────────┬────────┬──────────┐   │
│  │ Provider  │ Tokens │  Cost  │ Speed  │ Quality* │   │
│  ├───────────┼────────┼────────┼────────┼──────────┤   │
│  │ OpenAI    │ 100.3K │ $0.45  │ 0.1s   │ 4.2/5    │   │
│  │ Anthropic │  89.2K │ $0.38  │ 0.3s   │ 4.5/5    │   │
│  │ Google    │  95.7K │ $0.22  │ 0.2s   │ 4.0/5    │   │
│  │ Ollama    │ 112.1K │ FREE   │ 1.2s   │ 3.5/5    │   │
│  └───────────┴────────┴────────┴────────┴──────────┘   │
│  * Quality: 교차검증에서 다른 AI와의 합의율 기반          │
└─────────────────────────────────────────────────────────┘
```

### 4.7 Remote Access 구현 방안

> OpenYak의 TunnelManager + RemoteAuthMiddleware 직접 참조 (Appendix A.6)

#### 4.7.1 터널 구현 (OpenYak 패턴)

```javascript
// src/main/remote/tunnel.js
class TunnelManager {
  constructor() {
    this.process = null;
    this.tunnelUrl = null;
  }

  // OpenYak 패턴: cloudflared 바이너리 자동 다운로드
  async ensureBinary() {
    const binPath = path.join(app.getPath('userData'), 'bin', 'cloudflared');
    if (!fs.existsSync(binPath)) {
      await this.downloadBinary(process.platform, binPath);
    }
    return binPath;
  }

  // Quick Tunnel (Cloudflare 계정 불필요)
  async start(localPort) {
    const binPath = await this.ensureBinary();
    this.process = spawn(binPath, [
      'tunnel', '--url', `http://localhost:${localPort}`, '--no-autoupdate'
    ]);

    // stdout에서 터널 URL 파싱
    this.tunnelUrl = await this.parseTunnelUrl(this.process.stderr);
    return this.tunnelUrl;
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.tunnelUrl = null;
    }
  }
}
```

#### 4.7.2 내장 API 서버 (Express)

```javascript
// src/main/remote/server.js
const express = require('express');

function createRemoteServer(providerRegistry, scheduler) {
  const app = express();

  // OpenYak 패턴: Rate limiting
  app.use(rateLimit({ windowMs: 60000, max: 120 }));

  // Bearer 토큰 인증 (OpenYak의 RemoteAuthMiddleware 패턴)
  app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!validateToken(token)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });

  // API 엔드포인트
  app.post('/api/chat/prompt', async (req, res) => { /* ... */ });
  app.get('/api/sessions', async (req, res) => { /* ... */ });
  app.get('/api/usage', async (req, res) => { /* ... */ });

  return app;
}
```

#### 4.7.3 Permission Mode (OpenYak 패턴)

| 모드 | 동작 | 원격 시 |
|------|------|---------|
| `auto` | 안전한 도구 자동 승인, 위험 도구 거부 | 읽기 도구만 자동 허용 |
| `ask` | 모든 도구 사용자 확인 | IPC → 데스크톱 알림 → 사용자 응답 |
| `deny` | 모든 도구 거부 | 채팅만 가능, 파일 접근 불가 |

### 4.8 데이터 영속성 전략

#### 4.8.1 현재 → 미래 마이그레이션 경로

| 단계 | 저장소 | 대상 데이터 | npm 패키지 |
|------|--------|-----------|-----------|
| Phase 1 | Electron Store (JSON) | 설정, API 키, 프롬프트 | `electron-store` (기존) |
| Phase 2 | Electron Store + SQLite | + 사용량, 자동화 이력 | `better-sqlite3` |
| Phase 3 | SQLite 중심 | + 세션, 메시지, 교차검증 결과 | `better-sqlite3` |

**SQLite 선정 근거** (OpenYak 기반):
- OpenYak도 SQLite를 프로덕션 DB로 사용 (단일 사용자 데스크톱 앱에 적합)
- `better-sqlite3`는 동기 API로 Electron Main Process에서 직접 사용 가능
- JSON 컬럼 지원 (`json_extract`)으로 유연한 메타데이터 저장
- ULID PK로 시간순 정렬 + 고유성 보장

---

## 5. 구현 단계별 로드맵

### Phase 1: Foundation (MVP) - BYOK Core

**목표**: API 키 기반 다중 AI 직접 호출 및 교차검증

| 항목 | 상세 |
|------|------|
| 범위 | BYOK-001~004, USAGE-001~002 |
| 핵심 기능 | Provider 설정 UI, API 키 암호화 저장, 모델 선택, 기본 토큰 추적 |
| 대상 프로바이더 | OpenAI, Anthropic, Google AI (3개) |
| 예상 복잡도 | 중간 |
| 선행 조건 | 없음 |

### Phase 2: Cross-Verify Enhancement

**목표**: 웹뷰/API 하이브리드 교차검증 및 비용 분석

| 항목 | 상세 |
|------|------|
| 범위 | BYOK-005, BYOK-008, USAGE-003~006 |
| 핵심 기능 | API Panel 렌더링, 하이브리드 비교, 비용 대시보드, 예산 알림 |
| 예상 복잡도 | 높음 (기존 패널 시스템 확장) |
| 선행 조건 | Phase 1 완료 |

### Phase 3: Agent Execution Engine

**목표**: 교차검증 결과 기반 실제 작업 실행

| 항목 | 상세 |
|------|------|
| 범위 | AGENT-001~007 |
| 핵심 기능 | 실행 모드 UI, 파일 시스템 접근, 샌드박스, diff 미리보기, 롤백 |
| 예상 복잡도 | 매우 높음 (보안/안전 고려사항 다수) |
| 선행 조건 | Phase 1 완료 |

### Phase 4: Plugins & Automations

**목표**: 확장 가능한 도구 생태계 및 자동화

| 항목 | 상세 |
|------|------|
| 범위 | PLUG-001~004, AUTO-001~005 |
| 핵심 기능 | MCP 커넥터, Skills, 스케줄러, 자동화 템플릿 |
| 예상 복잡도 | 높음 |
| 선행 조건 | Phase 2 + Phase 3 완료 |

### Phase 5: Remote Access & Polish

**목표**: 모바일 원격 제어 및 전체 UX 개선

| 항목 | 상세 |
|------|------|
| 범위 | REMOTE-001~004, PLUG-005, AUTO-006 |
| 핵심 기능 | 터널 원격 접근, 마켓플레이스, 고급 자동화 |
| 예상 복잡도 | 높음 |
| 선행 조건 | Phase 4 완료 |

---

## 6. 예상 제약 사항

### 6.1 기술적 제약

| 제약 사항 | 영향 | 완화 방안 |
|----------|------|----------|
| **API 비용 부담** | BYOK 사용 시 사용자가 직접 API 비용 부담, 교차검증은 비용이 N배 증가 | 토큰 사용량 실시간 표시, 예산 한도 설정, 저비용 모델 자동 추천 |
| **Rate Limiting** | 다수 AI API 동시 호출 시 rate limit 도달 가능 | 프로바이더별 rate limit 감지, 자동 재시도 with exponential backoff, 요청 큐잉 |
| **웹뷰-API 응답 차이** | 동일 모델이라도 웹뷰(구독)와 API의 시스템 프롬프트/파라미터가 달라 응답 상이 가능 | 차이를 기능으로 활용 (비교 분석 포인트), 사용자에게 명확히 안내 |
| **Electron 메모리** | 다수 BrowserView + API 클라이언트 + Agent 엔진 동시 구동 시 메모리 과다 사용 | 패널 lazy loading, 미사용 패널 suspend, 메모리 모니터링 |
| **스트리밍 응답 처리** | 각 프로바이더별 스트리밍 프로토콜 차이 (SSE, WebSocket 등) | 통합 스트리밍 어댑터 레이어 구현 |
| **Ollama 의존성** | 사용자 환경에 Ollama 설치 필요, 모델 다운로드 시간/용량 | 자동 설치 안내, 경량 모델 추천, 설치 상태 감지 |

### 6.2 보안 제약

| 제약 사항 | 영향 | 완화 방안 |
|----------|------|----------|
| **API 키 노출 위험** | Electron 앱은 소스 코드가 asar 패키지로 노출될 수 있음 | OS keychain 사용 (electron safeStorage), 메모리 내 평문 최소화 |
| **Agent 파일 접근 보안** | 에이전트가 민감 파일에 접근하거나 악의적 코드 실행 가능 | 명시적 workspace 제한, 파일 작업 allowlist, 실행 전 사용자 확인 |
| **Remote Access 보안** | 외부 터널 노출 시 무단 접근 위험 | 토큰 기반 인증, HTTPS 강제, Permission Mode, 세션 타임아웃 |
| **MCP 서버 신뢰성** | Custom MCP 서버가 악의적일 수 있음 | 신뢰할 수 있는 출처 검증 안내, 커넥터별 권한 제한, 샌드박스 실행 |
| **OAuth 토큰 관리** | ChatGPT Subscription OAuth 토큰 갱신, 만료 처리 | 자동 갱신 로직, 만료 알림, 재인증 플로우 |

### 6.3 사용자 경험 제약

| 제약 사항 | 영향 | 완화 방안 |
|----------|------|----------|
| **설정 복잡도 증가** | BYOK, Plugins, Automations 등 설정 항목 급증 | 단계별 온보딩 위저드, 기본값 최적화, Progressive Disclosure |
| **학습 곡선** | 교차검증 → 에이전트 실행의 새로운 워크플로우 이해 필요 | 인터랙티브 튜토리얼, 템플릿 기반 시작, 도움말 시스템 |
| **동기화 지연** | 다수 AI API 응답 대기 시간이 교차검증 체감 속도 저하 | 스트리밍 응답 표시, 가장 빠른 응답 먼저 표시, 진행률 표시 |
| **결과 불일치 처리** | 교차검증에서 AI 간 결과가 크게 다를 때 사용자 혼란 | 불일치 이유 분석 도구, 추가 검증 제안, 합의도 시각화 |

### 6.4 비즈니스/운영 제약

| 제약 사항 | 영향 | 완화 방안 |
|----------|------|----------|
| **AI 서비스 TOS 준수** | 웹뷰 자동화가 서비스 약관에 위배될 수 있음 | BYOK API 방식을 1차 권장, 웹뷰는 보조 수단으로 포지셔닝 |
| **프로바이더 API 변경** | API 스키마/가격 변경 시 즉시 대응 필요 | API 어댑터 패턴으로 변경 영향 최소화, 버전 핀닝 |
| **데이터 프라이버시** | 교차검증 데이터가 여러 AI 서비스로 전송됨 | 민감 데이터 경고, 로컬 전용 모드 (Ollama), 데이터 전송 범위 시각화 |
| **오프라인 사용** | API/웹뷰 모두 인터넷 필수 (Ollama 제외) | Ollama 로컬 모드 강화, 캐시된 결과 오프라인 열람 |

### 6.5 기존 아키텍처 호환성 제약

| 제약 사항 | 영향 | 완화 방안 |
|----------|------|----------|
| **Vanilla JS 코드베이스** | 프레임워크 없이 복잡한 UI 상태 관리 필요성 증가 | 경량 상태 관리 패턴 도입 (Proxy-based reactivity 등), 점진적 모듈화 |
| **BrowserView 기반 패널** | API 패널은 BrowserView가 아닌 자체 렌더링 필요 | 별도 렌더러 컴포넌트 구현, 공통 인터페이스 추상화 |
| **Electron Store 한계** | 대량 Usage 데이터, 자동화 이력 저장 시 성능 이슈 | SQLite(better-sqlite3) 또는 IndexedDB 도입 검토 |
| **단일 window 구조** | Plugins, Settings, Automations 등 UI 영역 확장 | 기존 설정 모달을 탭 기반 풀 페이지 Settings로 확장 |

---

## 7. 경쟁 분석 및 차별화 전략

### 7.1 OpenYak vs SMC 기술 스택 비교 (소스 코드 기반)

| 항목 | OpenYak (소스 분석) | SMC (현재) | SMC (목표) |
|------|---------|-----------|-----------|
| **핵심 가치** | 단일 AI + 작업 실행 | 다중 AI 교차검증 | 교차검증 + 실행 |
| **Desktop** | Tauri 2.10 (Rust, 경량) | Electron 39 (Node.js) | Electron 유지 |
| **Frontend** | Next.js 15 + React 19 + Zustand | Vanilla JS (빌드 없음) | Vanilla JS + 점진적 모듈화 |
| **Backend** | Python FastAPI (별도 프로세스) | Electron Main (통합) | Electron Main (통합) |
| **DB** | SQLite (aiosqlite, async) | Electron Store (JSON) | Electron Store → SQLite |
| **Provider** | 21 BYOK + OAuth + Ollama | 웹뷰 6개 서비스 | 웹뷰 + BYOK 8+ + Ollama |
| **AI 수** | 단일 세션, 단일 모델 | 최대 6개 동시 | 최대 10+ 동시 (웹뷰+API) |
| **Agent** | SessionProcessor + 20+ 도구 | 없음 | 교차검증 기반 Agent |
| **확장성** | Plugins/Skills/MCP (46 커넥터) | Prompt Hub | Plugins/Skills/MCP |
| **자동화** | TaskScheduler (cron, 3동시) | 없음 | 교차검증 자동화 |
| **원격** | Cloudflare Tunnel + JWT | 없음 | 동일 패턴 |
| **권한** | 4-Layer Permission | 없음 | 4-Layer 적용 |
| **코드 규모** | ~23K LOC (Backend) + ~1.6MB (Frontend) | ~15K LOC (추정) | 확장 |

### 7.2 아키텍처 의사결정: OpenYak 패턴을 SMC에 적용 시 차이

| 의사결정 | OpenYak 방식 | SMC 적용 방식 | 근거 |
|---------|-------------|-------------|------|
| Backend 분리 | 별도 Python 프로세스 | Electron Main에 통합 | SMC는 이미 Electron Main에서 Puppeteer 관리, Node.js SDK 직접 사용 가능 |
| 프론트엔드 프레임워크 | Next.js + React | Vanilla JS 유지 | 기존 코드 자산 보존, 새 기능은 모듈 단위로 추가 |
| 상태 관리 | Zustand + React Query | Electron Store + IPC | Electron IPC가 상태 동기화 역할 |
| 스트리밍 | SSE (HTTP) | IPC (Electron) | 별도 HTTP 서버 불필요, IPC로 직접 스트리밍 |
| DB | SQLAlchemy + aiosqlite | better-sqlite3 (동기) | Electron Main은 동기 DB 접근이 더 자연스러움 |
| MCP | Python `mcp` SDK | `@modelcontextprotocol/sdk` (JS) | npm 생태계에 공식 SDK 존재 |

### 7.3 SMC의 고유 차별화 포인트

1. **교차검증 기반 실행**: 단일 AI가 아닌, 다수 AI의 합의에 기반한 작업 실행 → 높은 신뢰도
2. **비용 효율 비교**: 동일 작업에 대한 다중 AI 비용/품질 비교 → 최적 AI 선택 (OpenYak은 단일 AI라 비교 불가)
3. **프롬프트 A/B 테스트**: Prompt Hub + BYOK로 동일 프롬프트의 API별 성능 벤치마크
4. **하이브리드 접근**: 무료(웹뷰) + 유료(API)를 상황에 따라 선택적 사용 (OpenYak은 API 전용)
5. **웹뷰/API 응답 비교**: 동일 모델의 웹뷰 vs API 응답 차이 분석 (이 기능은 시장에 없음)

---

## 8. Open Questions (소스 코드 분석 후 업데이트)

### 8.1 해결된 질문 (소스 코드 분석으로 답변)

| 질문 | 답변 (OpenYak 소스 기반) |
|------|------------------------|
| API Panel 렌더링 방식 | Electron webContents에 자체 HTML 로드, IPC로 스트리밍 데이터 전달 (OpenYak은 Next.js SPA 내에서 렌더링) |
| Plugin 배포 방식 | 디렉토리 기반 (`plugin.json` + `skills/` + `mcp.json`), OpenYak과 동일 포맷 호환 가능 |
| Agent 실행 언어 | Node.js child_process 기반 셸 실행 (OpenYak의 `bash` 도구 패턴), 파일 I/O는 Node.js fs API |
| 데이터 영속성 전환 | better-sqlite3 (동기 API), OpenYak도 SQLite 사용. Phase 2에서 전환, Electron Store는 설정 전용으로 유지 |

### 8.2 남은 Open Questions

1. **교차검증 자동화 수준**: API 응답에 대한 자동 합의 추출 알고리즘은? 단순 텍스트 비교? LLM 기반 분석?
   - OpenYak에는 교차검증 기능 자체가 없으므로 참조 불가 → SMC 자체 설계 필요

2. **오프라인 모드 범위**: Ollama 지원 외에, 과거 교차검증 결과의 오프라인 열람/검색 지원 여부
   - OpenYak은 SQLite FTS5(전문 검색) 구현 → SMC도 동일 패턴 적용 가능

3. **UI 프레임워크 전환 필요성**: 현재 Vanilla JS로 Provider Settings, Plugin UI, Automation UI, Usage Dashboard를 모두 구현 가능한가?
   - OpenYak은 React + Zustand + Radix로 203개 컴포넌트 관리 → SMC는 기능 추가 시 복잡도 급증 예상
   - 권장: 기존 채팅 UI는 Vanilla JS 유지, 새 Settings/Plugin/Automation 페이지는 Lit Element 또는 Web Components로 구현

4. **웹뷰 패널과 API 패널의 응답 동기화**: 동일 프롬프트를 웹뷰와 API에 동시 전송 시, 응답 완료 시점이 다른 경우 교차검증 타이밍 처리
   - OpenYak에는 해당 시나리오 없음 → SMC 고유 설계 필요

5. **OpenYak Plugin 호환성**: OpenYak의 기존 15개 Built-in Plugin을 SMC에서 그대로 사용 가능한가?
   - 포맷은 호환 가능 (`.claude-plugin/plugin.json` + `SKILL.md`)
   - MCP 서버 연결은 별도 테스트 필요

6. **시스템 트레이 상주**: Automation 실행을 위한 백그라운드 모드 시, 메모리 최적화 전략
   - OpenYak: Tauri 자체가 경량 (30-50MB), Python 백엔드는 별도
   - SMC: Electron 기반이라 메모리 풋프린트 큼 (200MB+) → 백그라운드 시 웹뷰 해제 필요

7. **Rate Limit 분산 전략**: 동일 프로바이더에 웹뷰와 API로 동시 접근 시, rate limit이 공유되는지 여부
   - 웹뷰(구독)와 API(키)는 별도 계정/한도일 수 있으나, 동일 IP에서의 요청은 IP 기반 제한에 걸릴 수 있음

---

## 9. 참고 스크린샷 인덱스

| 파일명 | 설명 | 관련 Feature |
|--------|------|-------------|
| new_chat.png | 메인 채팅 화면, 모델 선택 드롭다운 | BYOK, Agent |
| new_chat_mode_expand.png | 실행 모드 선택 (Plan/Ask/Auto) | Agent |
| settings_provider_setup.png | Provider 설정 (4가지 옵션) | BYOK |
| settings_openai_codex_authenticate_request.png | OAuth 인증 대기 화면 | BYOK |
| settings_openai_codex_oauth_screeb.png | OpenAI OAuth 동의 화면 | BYOK |
| settings_usage_monitor.png | 사용량 모니터링 대시보드 | Usage Monitor |
| plugins_and_skills_plugins.png | Plugin 목록 (15개) | Plugins |
| plugins_and_skills_plugins_expanded.png | Plugin 상세 (Skills + Connectors) | Plugins |
| plugins_and_skills_skills.png | Skills 목록 (22개) | Skills |
| plugins_and_skills_connectors.png | Connectors 목록 (46개, 카테고리별) | Connectors |
| plugins_and_skills_connectors_add_custom.png | Custom Connector 추가 (MCP URL) | Connectors |
| automations_active.png | Automations - Active 탭 | Automations |
| automations_all.png | Automations - All 탭 | Automations |
| automations_new_automation_interval.png | 새 자동화 - Interval 모드 | Automations |
| automations_new_automation_scheduled.png | 새 자동화 - Scheduled 모드 | Automations |
| automations_templates.png | 자동화 템플릿 (5개) | Automations |
| remote_access.png | Remote Access - 비활성 상태 | Remote Access |
| remote_access_on.png | Remote Access - 활성 상태 (QR, 토큰, 권한) | Remote Access |

---

## 10. 결론

이 ideation은 SMC를 **"교차검증 도구"에서 "교차검증 기반 실행 플랫폼"으로 진화**시키는 방향을 제시한다.

핵심 전환:
- **Before**: "여러 AI에게 물어보고 비교한다" (정보 소비)
- **After**: "여러 AI의 합의를 바탕으로 실제 작업을 실행한다" (가치 생산)

Phase 1(BYOK Core)부터 점진적으로 구현하되, 각 Phase의 구체적 SPEC은 이 ideation을 기반으로 별도 작성한다.

---

*이 문서는 구현 착수 전 요구사항 정의 및 기술 검토를 위한 초안입니다. 구체적 SPEC 작성 및 구현은 이 문서의 리뷰와 승인 후 진행합니다.*

---

## Appendix B. OpenYak 소스 코드 핵심 참조 경로

구현 시 직접 참조할 OpenYak 소스 코드 경로 (모두 `references/desktop/` 하위):

### B.1 Backend (Python/FastAPI)

| 기능 영역 | 경로 | 핵심 패턴 |
|----------|------|----------|
| **Provider Registry** | `backend/app/provider/registry.py` | ProviderRegistry, resolve_model, refresh_models |
| **Provider Catalog** | `backend/app/provider/catalog.py` | 21개 프로바이더 정의, ProviderDef |
| **OpenAI-Compatible** | `backend/app/provider/openai_compat.py` | 범용 OpenAI-호환 어댑터 |
| **Anthropic Native** | `backend/app/provider/anthropic_provider.py` | 네이티브 Anthropic SDK |
| **Gemini Native** | `backend/app/provider/gemini_provider.py` | 네이티브 Google SDK |
| **Ollama** | `backend/app/provider/ollama.py`, `backend/app/ollama/manager.py` | 로컬 모델, 바이너리 관리 |
| **OAuth** | `backend/app/provider/openai_oauth.py`, `backend/app/mcp/oauth.py` | PKCE, 토큰 교환/갱신 |
| **모델 가격** | `backend/app/provider/models_dev.py` | 가격/능력 메타데이터 |
| **Session 실행 루프** | `backend/app/session/processor.py` | 핵심 LLM → 도구 → 저장 루프 |
| **Permission** | `backend/app/agent/permission.py` | 4-Layer 권한 평가 |
| **도구 시스템** | `backend/app/tool/registry.py`, `backend/app/tool/builtin/` | ToolRegistry, 내장 도구 구현 |
| **MCP 클라이언트** | `backend/app/mcp/client.py`, `backend/app/mcp/manager.py` | McpClient, McpManager |
| **Connector Registry** | `backend/app/connector/registry.py` | 중복 제거, 영속화, 도구 노출 |
| **Plugin 로더** | `backend/app/plugin/loader.py`, `backend/app/plugin/parser.py` | 디스커버리, plugin.json 파싱 |
| **Skill Registry** | `backend/app/skill/registry.py`, `backend/app/skill/model.py` | SKILL.md 파싱, 디스커버리 |
| **Scheduler** | `backend/app/scheduler/engine.py`, `backend/app/scheduler/executor.py` | TaskScheduler, cron 폴링 |
| **Tunnel** | `backend/app/auth/tunnel.py` | Cloudflare Tunnel 관리 |
| **Auth Middleware** | `backend/app/auth/middleware.py` | Rate limiting, Bearer 토큰 |
| **Usage API** | `backend/app/api/usage.py` | 토큰/비용 집계 쿼리 |
| **DB 모델** | `backend/app/models/` | Session, Message, Part, ScheduledTask |
| **설정** | `backend/app/config.py` | Pydantic Settings, 21 API 키 필드 |
| **Connector 카탈로그** | `backend/data/connectors.json` | 46개 사전 정의 커넥터 |
| **번들 플러그인** | `backend/data/plugins/` | bio-research, cowork-plugin-management |
| **번들 스킬** | `backend/data/skills/` | 내장 스킬 MD 파일 |

### B.2 Frontend (Next.js/React)

| 기능 영역 | 경로 | 핵심 패턴 |
|----------|------|----------|
| **Provider 설정 UI** | `frontend/src/components/settings/providers-tab.tsx` | BYOK/OAuth/Ollama 탭 |
| **모델 선택** | `frontend/src/hooks/use-models.ts` | 모델 목록 조회 |
| **Plugins UI** | `frontend/src/app/(main)/plugins/content.tsx` | 3탭 (Connectors/Plugins/Skills) |
| **Automations UI** | `frontend/src/app/(main)/automations/content.tsx` | Active/All/Templates 탭 |
| **Remote UI** | `frontend/src/app/(main)/remote/content.tsx` | 터널/QR/토큰/권한 |
| **Usage Dashboard** | `frontend/src/components/settings/usage-tab.tsx` | Recharts 차트, 집계 카드 |
| **Chat Interface** | `frontend/src/components/chat/chat-view.tsx` | 메인 채팅 컨테이너 |
| **SSE Streaming** | `frontend/src/hooks/use-sse.ts` | EventSource, 재연결 |
| **Settings Store** | `frontend/src/stores/settings-store.ts` | Zustand, 모델/모드/권한 |
| **Chat Store** | `frontend/src/stores/chat-store.ts` | 스트리밍 파트, 버퍼 |
| **Permission Dialog** | `frontend/src/components/interactive/permission-dialog.tsx` | 도구 권한 요청 UI |
| **Activity Panel** | `frontend/src/components/activity/activity-panel.tsx` | 도구 실행 타임라인 |
| **Artifact Panel** | `frontend/src/components/artifacts/artifact-panel.tsx` | 미리보기, 버전 관리 |
| **타입 정의** | `frontend/src/types/` | 17개 타입 파일 |

### B.3 Desktop (Tauri/Rust)

| 기능 영역 | 경로 | 핵심 패턴 |
|----------|------|----------|
| **앱 초기화** | `desktop-tauri/src-tauri/src/lib.rs` | 플러그인, 이벤트, 상태 |
| **백엔드 관리** | `desktop-tauri/src-tauri/src/backend.rs` | 프로세스 수명주기, 헬스체크, 크래시 복구 |
| **IPC 핸들러** | `desktop-tauri/src-tauri/src/commands.rs` | get_backend_url, 파일 다운로드 |
| **시스템 트레이** | `desktop-tauri/src-tauri/src/tray.rs` | 트레이 메뉴, 이벤트 |
| **네이티브 메뉴** | `desktop-tauri/src-tauri/src/menu.rs` | 키보드 단축키, 네비게이션 |
| **보안 권한** | `desktop-tauri/src-tauri/capabilities/default.json` | 허용 API 목록 |
| **빌드 설정** | `desktop-tauri/src-tauri/tauri.conf.json` | CSP, 창 설정, 업데이트 |
