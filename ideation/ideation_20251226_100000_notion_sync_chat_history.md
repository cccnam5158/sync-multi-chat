# Ideation: Notion Sync for Chat History (Full Sessions + Per‑Service Threads)

## 1. 개요 (Overview)
Sync Multi Chat의 **챗 히스토리 “전체 내역”**(세션 목록)과 **개별 세션의 “전체 스레드”**(각 AI 서비스의 사용자 프롬프트 + 응답 전체)을 **Notion에 동기화**하는 기능을 제안한다.

본 문서는 다음을 다룬다.
- **UX/UI 제안**: 사용자가 어떤 플로우로 Notion 연동/선택/동기화를 수행할지
- **기술적 Feasibility**: Notion API 인증/데이터 모델/업서트/제약/리스크/단계적 구현 전략
- **동기화 단위**: (A) 세션 단위 동기화, (B) 서비스별 스레드 단위 동기화, (C) 전체 히스토리 일괄 동기화

> Repo 관찰: 현재 앱은 `HistoryManager(IndexedDB)`로 **세션 메타데이터**를 저장하고, `copy-chat-thread`(main process)로 **각 서비스 DOM에서 전체 스레드를 추출**해 Markdown/JSON 형태로 내보낼 수 있는 기반이 존재한다. 따라서 Notion Sync는 “추출 → 변환 → Notion 업서트” 파이프라인으로 자연스럽게 확장 가능하다.

---

## 2. 목표 / 비목표

### 2.1 목표 (Goals)
- 세션 단위로 **Notion 페이지/DB에 업서트(중복 없이 갱신)** 가능
- 개별 서비스(예: ChatGPT/Claude/…) 별로 **해당 세션의 전체 스레드**를 Notion에 저장
- “전체 히스토리” (최근 N개) **일괄 동기화** 지원
- 동기화 상태(성공/부분성공/실패), 마지막 동기화 시간, 에러 원인 **가시화**
- 익명 모드(서비스 A/B…)를 고려한 **익명화 옵션** 지원

### 2.2 비목표 (Non‑Goals) — 1차 범위에서 제외 권장
- Notion과의 양방향 편집/충돌 해결(사용자가 Notion에서 수정한 내용을 앱으로 역수입)
- 첨부 파일(로컬 파일 바이너리) 업로드를 Notion에 “파일로” 직접 업로드
  - Notion API는 보통 **external URL 기반 file block**이 중심이라 “로컬 바이너리 업로드”는 별도 스토리지(예: S3) 없이는 제한이 큼
- Notion 페이지의 완벽한 서식 재현(LaTeX/복잡한 표/서비스별 커스텀 렌더링 100% 동일)

---

## 3. 사용자 시나리오 / UX 요구사항

### 3.1 핵심 사용자 시나리오
- **S1: Notion 연결**
  - 사용자는 Settings에서 Notion Integration Token(OAuth 또는 Internal Integration Token)을 등록하고, 저장할 Notion Database 또는 Parent Page를 선택한다.
- **S2: 현재 세션 동기화**
  - 사용자는 현재 활성 세션을 Notion에 “Sync” 클릭 → 각 서비스의 전체 스레드를 추출하여 Notion 페이지에 저장한다.
- **S3: 히스토리(여러 세션) 일괄 동기화**
  - 히스토리 사이드바에서 “Sync All (최근 50개)” 실행 → 진행률 표시, 실패 항목 재시도 지원.
- **S4: 서비스별 부분 동기화**
  - “ChatGPT만 / Claude만” 등 일부 서비스만 선택해서 동기화(부분 추출 실패 대비).
- **S5: 자동 동기화 옵션**
  - (선택) “세션 전환 시/새 채팅 생성 시/주기적으로” 자동 동기화.

---

## 4. UX/UI 제안 (Wire 수준)

### 4.1 Settings > Integrations > Notion
- **Connect Mode**
  - Option A (1차 추천): **Internal Integration Token 입력 방식**
    - 장점: 구현 단순, 안정적
    - 단점: 사용자가 토큰을 직접 생성/입력해야 함
  - Option B (2차): **OAuth 연결**
    - 장점: UX 매끄러움
    - 단점: Electron OAuth 리다이렉트/딥링크/보안 고려 필요, 구현 복잡

- **Target 선택**
  - **Database 모드**: “세션 1개 = DB row + page content”
  - **Page 모드**: “부모 페이지 아래에 세션 페이지 생성”
  - UI 구성 예:
    - Radio: `Database` / `Page`
    - 입력: Database ID or Page ID (초기엔 수동 입력 가능)
    - (개선) 버튼: “Search & Select” → Notion `search` API로 목록 표시

- **Sync 옵션**
  - Toggle: `익명 모드로 저장` (서비스명 A/B…)
  - Toggle: `세션 메타데이터 포함`(URLs/layout/activeServices/prompt)
  - Toggle: `서비스별 페이지 분리`(하위 페이지) vs `한 페이지에 섹션으로 통합`
  - Select: `포맷` = Markdown blocks / Plain text / Code block(마크다운 원문)
  - Select: `동기화 범위` = 전체 스레드 / 마지막 N턴(예: 20)

- **상태/진단**
  - Last sync time, last error
  - “Test connection” 버튼(권한/ID 유효성 검증)

### 4.2 히스토리 사이드바/세션 컨텍스트 메뉴
현재 세션의 컨텍스트 메뉴(Rename/Delete 등)에 추가 제안:
- **Sync to Notion**
- **Sync to Notion (Services...)** → 체크박스 모달
- **Open Notion Page**(이미 링크된 경우)
- **Copy Notion Link**

히스토리 상단에 추가:
- **Sync All (last 50)** / **Sync Selected**

### 4.3 동기화 진행 UI
- 진행률 바 + 서비스별 상태 리스트
  - 예: `ChatGPT: Success`, `Claude: Failed (selector changed)`, …
- 실패 항목만 “Retry” 버튼 제공
- 동기화 중 사용자 상호작용 최소화(특히 “추출”이 DOM 기반이므로)
  - 단, 현재 구현은 `executeJavaScript` 중심이라 **클립보드 경합은 없음**(native copy 버튼 방식이 아니라서)

---

## 5. 데이터 모델 제안 (Notion 측)

### 5.1 Notion Database(권장) 스키마
Database 이름 예: `Sync Multi Chat Sessions`

권장 Properties:
- **Title**: `Session Title`
- **Session ID**: text (앱 내부 `session.id`)
- **Created At**: date
- **Updated At**: date
- **Active Services**: multi-select (chatgpt/claude/…)
- **Layout**: select (1x4, 2x2, …)
- **Anonymous Mode**: checkbox
- **URLs**: rich text 또는 별도 JSON string
- **Sync Status**: select (Synced/Partial/Failed)
- **Last Synced At**: date
- **Content Hash**: text (업서트/변경 감지용)

세션 page content(본문)에는:
- 섹션 방식: `# ChatGPT` / `# Claude` … 아래에 해당 스레드
- 또는 하위 페이지 방식: `Session Page` 아래 `ChatGPT Thread`, `Claude Thread` 등 child page 생성

### 5.2 업서트 키(중복 방지)
- Notion DB에서 `Session ID`로 검색하여 기존 row/page를 찾고,
  - 있으면 update + append/replace
  - 없으면 create

> Notion API는 “DB에서 특정 property로 query”가 가능하므로 `Session ID`가 업서트 키로 적합.

---

## 6. 기술적 Feasibility 분석

## 6.1 현재 코드 기반과의 접점(재사용 포인트)
- 앱은 이미 main process에서 `extractContentFromService(service)`로 **서비스별 전체 스레드 추출** 가능
- 결과는 Markdown(부분적으로 HTML→Markdown 변환 포함) 또는 JSON으로 구성 가능
- 따라서 Notion Sync는 아래 3단계를 재사용/확장하면 된다.
  1) **Extraction**: 서비스별 스레드 추출 (이미 존재)
  2) **Normalization**: 내부 공통 포맷(예: `{service, content, method, timestamp}`)
  3) **Notion Write**: Notion API로 page/db에 저장

### 6.2 Notion 인증 방식 비교 (Token vs OAuth)

#### A) Internal Integration Token (1차 추천)
- 사용자가 Notion에서 Integration 생성 후 “Internal Integration Token” 복사
- 저장 대상 DB/Page를 Integration에 Share 해야 함
- 장점: 구현 난이도 낮고 안정적
- 단점: 사용자가 초기 설정을 이해해야 함(가이드 필요)

#### B) OAuth (2차 로드맵)
- Electron 앱에서 OAuth authorization URL 오픈 → redirect를 커스텀 스킴/로컬 서버로 수신
- 장점: UX 매끄럽고 토큰 관리가 체계적
- 단점: deep link/redirect 처리, 보안, 토큰 갱신 로직 등 복잡

권장 로드맵: **A로 MVP → B로 개선**

### 6.3 토큰 저장 위치/보안
- `electron-store`를 이미 사용 중이므로 Notion token 저장에 활용 가능
- 보안 고려:
  - Windows 자격 증명 관리자 등 OS keychain 연동이 더 안전하지만 1차는 `electron-store`로 시작 가능
  - 최소한 UI에 “민감정보 저장됨” 고지 + “Disconnect(토큰 삭제)” 제공
- 프로세스 위치:
  - Notion API 호출은 **main process**에서 수행 권장
    - 이유: Node 환경/네트워크/토큰 접근 일원화, renderer로 토큰 노출 최소화

### 6.4 Notion API 제약(중요)
- **Rate limit**: 대략 초당 요청 제한(일반적으로 3 rps 수준) → 일괄 동기화는 큐/스로틀 필요
- **Block append 제한**: `append block children`는 요청당 최대 블록 수 제한(보통 100개) → chunking 필요
- **Rich text 길이 제한**: 한 블록의 rich_text는 길이 제한이 있어 긴 텍스트는 여러 paragraph로 쪼개야 함
- **Markdown 직접 저장 불가**: Notion은 “Markdown 문자열”을 그대로 렌더링해주는 API가 없다.
  - 선택지:
    1) **Plain text paragraphs로 저장**(가장 쉬움, 서식 손실)
    2) **Code block에 Markdown 원문을 넣기**(서식은 “원문 보존”, Notion에서 읽기 좋지는 않음)
    3) **Markdown→Notion blocks 변환기 구현/도입**(가장 좋은 UX, 구현 비용 있음)

MVP 권장: **(2) Code block + 일부 헤더/구분선만 block으로**  
차선: (1) Plain text  
고급: (3) Markdown parser

### 6.5 동기화 전략(전체/증분/업서트)

#### 6.5.1 동기화 단위
- **세션 단위**(권장): 사용자의 “한 번의 작업/대화 묶음”을 하나의 Notion 페이지로 저장
- 세션 내에 **서비스별 섹션**(ChatGPT/Claude/…)로 분리하여 비교/정리 용이

#### 6.5.2 변경 감지(증분 동기화)
- DOM 기반 추출은 매번 전체를 가져오는 경향이 있음 → 변경 감지로 비용 절감 가능
- 전략:
  - 추출 결과(서비스별 content)를 합쳐 **hash** 생성
  - 이전 hash와 같으면 Notion write skip
  - 달라졌으면 update/append
- 주의: 서비스 UI 변화/노이즈 텍스트로 hash가 불안정해질 수 있음 → 노이즈 제거 규칙 강화 필요

#### 6.5.3 “Replace vs Append” 정책
- Replace:
  - Notion page의 children을 전부 삭제 후 재작성은 API상 제약/비용이 큼(삭제도 블록 단위)
- Append:
  - 변경분만 append하면 중복이 생길 수 있음
- 현실적 절충안(MVP):
  - page 본문은 “마지막 동기화 시각/해시”를 포함한 **고정 헤더 블록**
  - 대화 본문은 매번 **새 섹션으로 append**하고, 섹션 제목에 sync timestamp를 넣어 중복을 사용자에게 명확히 노출
  - (향후) 블록 ID를 저장하여 해당 섹션만 교체하는 방식으로 개선

---

## 7. Notion 저장 포맷 옵션 (권장안 포함)

### Option 1) Markdown 원문을 Code Block으로 저장 (MVP 추천)
- page에 다음 구조:
  - Title = session title
  - Properties = 메타데이터
  - Children:
    - Heading: “Extracted Threads”
    - Code block(language: markdown): “서비스별 통합 markdown”
- 장점: 구현이 가장 쉽고, 추출 결과 손실 최소
- 단점: Notion에서 바로 “문서처럼” 보기엔 아쉬움

### Option 2) Plain Text 블록으로 저장
- 장점: 구현 쉬움
- 단점: 서식/코드블록/표 손실

### Option 3) Markdown → Notion Blocks 변환 (고급)
- GFM 일부(헤더/리스트/코드펜스/인라인 코드/링크) 파싱하여 Notion blocks로 매핑
- 장점: Notion에서 읽기 최고
- 단점: 구현/엣지케이스 비용 큼, 긴 텍스트 chunking 필수

권장: **Option1로 MVP → Option3로 개선**

---

## 8. 에러/리스크 및 대응

### 8.1 DOM 추출 실패(Selector 변경)
- 현상: 특정 서비스에서 `extractContentFromService`가 null 반환
- 대응:
  - Notion Sync 결과를 “Partial”로 기록
  - UI에 서비스별 실패 표시 + 재시도 제공
  - (향후) selectors health check / 자동 fallback 강화

### 8.2 Notion 권한 문제(공유 누락, ID 오입력)
- 대응:
  - “Test connection”에서 DB/Page 접근 시도 및 친절한 가이드 메시지
  - “이 DB를 Integration에 공유했는지 확인” 안내

### 8.3 대용량 스레드(블록 제한/길이 제한)
- 대응:
  - chunking(100 blocks/request)
  - long text split(문단 분할)
  - MVP는 code block 1~N개로 분할

### 8.4 개인정보/보안
- 사용자가 명시적으로 동기화 버튼을 누르기 전에는 외부 전송 없음
- 익명 모드로 서비스명 치환 옵션 제공
- “Disconnect & Delete token” 제공

---

## 9. 단계적 구현 로드맵 (현실적인 순서)

### Phase 0: UX/설정 화면 뼈대
- Settings에 Notion 토큰/대상 ID 입력 UI
- Test connection(간단한 Notion API 호출)

### Phase 1 (MVP): “현재 세션 → Notion으로 내보내기”
- main process에서 서비스별 스레드 추출(기존 로직 재사용)
- Notion page 생성(또는 DB row 생성) + code block에 markdown 저장
- 동기화 결과(성공/실패) UI 표시
- 세션에 notionPageId/lastSyncedAt 저장(향후 업서트 기반)

### Phase 2: “전체 히스토리 일괄 동기화”
- 최근 N개 세션 대상으로 큐/스로틀 동기화
- 진행률/재시도/중단 기능

### Phase 3: 변환 품질 개선
- Markdown→Notion blocks 부분 지원(헤더/코드/리스트 중심)
- Replace 정책 개선(블록 ID 저장 후 해당 섹션만 교체)

### Phase 4: OAuth 연결
- 토큰 발급/갱신 자동화 및 UX 개선

---

## 10. 오픈 질문(설계 확정 필요)
1) “전체 히스토리”의 정의: **최근 N개**? 전체? 사용자 선택?
2) Notion 대상: **Database** 중심으로 갈지, **Page** 중심으로 갈지(혹은 둘 다)
3) 동기화 정책: 매번 append(타임스탬프 섹션) vs 특정 섹션 교체
4) 서비스별 페이지 분리 여부(한 페이지에 통합 vs 하위 페이지)
5) 첨부파일 처리 범위(파일명/메타만 기록? 외부 링크 업로드 가능할 때만 file block?)

---

## 11. 결론(추천안)
- **MVP는 Internal Integration Token + Database 업서트 + Markdown 원문을 code block으로 저장**이 가장 빠르고 리스크가 낮다.
- 이미 존재하는 “서비스별 전체 스레드 추출” 기반을 재사용하여, Notion Sync는 기능 추가의 ROI가 높다.
- 이후 품질(서식)과 UX(OAuth)는 단계적으로 강화한다.

---
## Appendix: 내부 파이프라인 개념(요약)
Extract (per service) → Normalize → Compose (merged markdown) → Notion create/update → Save sync metadata

## (추가) UX Wireframe: Notion Sync UI 배치 계획 (src/renderer/index.html 기준)

### 1) 현재 index.html의 “놓을 자리” 요약
- 좌측: `#history-sidebar`
  - 헤더: `.sidebar-header` (햄버거 + “Chat History”)
  - 리스트: `#history-list` (세션 아이템 JS 주입)
  - 푸터: `.sidebar-footer` (현재 `Clear All`만 존재)
- 하단 컨트롤: `#controls-container > #toggles > .toggles-content`
  - New Chat / Copy Chat Thread / Copy Last Response / Cross Check / Anonymous / Scroll Sync / Layout / Service toggles
- 모달: 파일 하단에 여러 `.modal`들이 나열되어 있음(크로스체크/히스토리 삭제/리네임/클리어올 등)
  - 동일 패턴: `<div class="modal"> <div class="modal-content"> <div class="modal-header"> ...`

이 구조를 유지하면서 “Notion Sync”는 다음 3개 UI로 나눠서 배치한다.
- (A) **Notion 설정 모달**: 토큰/대상/옵션/테스트
- (B) **히스토리 메뉴 액션**: “현재 세션 Sync”, “전체 Sync”, “Notion 열기”
- (C) **진행/결과 모달**: 진행률 + 서비스별 결과 + 재시도/링크

---

### 2) 와이어프레임(텍스트 레이아웃)

#### 2.1 하단 컨트롤바(빠른 액션)
배치 위치: `#toggles .toggles-content`에서 Copy 버튼들 근처(사용자가 “내보내기/정리” 작업을 한 곳에서 수행)


