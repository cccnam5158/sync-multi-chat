# Single AI Mode - 단일 AI 서비스 멀티 인스턴스 기능

## 1. Overview (개요)

현재 Sync Multi Chat은 6개의 AI 서비스(ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark) 중 최대 4개를 동시에 선택하여 사용하는 **Multi AI Mode**를 제공합니다. 이번 기능은 하나의 AI 공급사 서비스를 최대 4개 인스턴스로 동시에 사용할 수 있는 **Single AI Mode**를 추가하는 것입니다.

### 1.1 사용자 시나리오

> "나는 1개의 AI 구독 서비스만 쓰는데... 다른 건 무료 버전이 가능하지만 나의 기호와는 안맞아... 
> Sync Multi Chat이 좋아보이기는 하는데 내가 쓰기엔 제약이 있어 보여... 
> 만약 내가 구독하는 AI 서비스를 여러개 열어서 쓸 수 있으면 좋겠는데..."

### 1.2 핵심 가치

- **구독 효율 극대화**: 하나의 유료 AI 서비스로 멀티 뷰 활용
- **응답 비교**: 동일 AI의 여러 세션에서 다른 컨텍스트로 응답 비교
- **병렬 작업**: 하나의 AI 서비스로 여러 주제를 동시에 탐색
- **무료 사용자 지원**: 무료 버전 AI 하나만으로도 멀티 채팅 경험 제공

---

## 2. User Requirements (사용자 요구사항)

### 2.1 모드 전환 UI

#### 2.1.1 설정 진입점
- **위치**: 서비스 토글 버튼 영역의 **맨 우측**에 기어(⚙️) 아이콘 버튼 추가
- **아이콘**: Settings/Gear 아이콘 (SVG)
- **동작**: 클릭 시 모드 설정 모달 팝업 표시

#### 2.1.2 모드 설정 모달
- **모달 구조**:
  - 헤더: "Chat Mode Settings" + 닫기(×) 버튼
  - 본문: 두 개의 모드 선택 카드
  - 푸터: (선택적) 현재 설정 요약

- **모드 선택 버튼** (추천 텍스트):
  | 옵션 | 버튼 텍스트 | 부제목/설명 |
  |------|------------|------------|
  | 1 | **Multi AI** | Use multiple AI services together |
  | 2 | **Single AI** | Use one AI service in multiple views |

  **대안 텍스트 후보**:
  - "Diverse Mode" / "Focused Mode"
  - "Multi Provider" / "Single Provider"
  - "Mix & Match" / "One Service"

#### 2.1.3 Single AI Mode 상세 UI
- 모드 선택 후 AI 서비스 선택 드롭다운 또는 아이콘 그리드 표시
- 선택 가능 서비스: ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark
- 선택 후 "Apply" 버튼으로 적용

### 2.2 Single AI Mode 동작

#### 2.2.1 토글 영역 변화
- Multi AI Mode 토글들 대신 선택된 AI 서비스의 아이콘과 체크박스가 **1~4개** 표시
- 레이블 표시 예시:
  - `[✓] ChatGPT #1`
  - `[✓] ChatGPT #2`
  - `[ ] ChatGPT #3`
  - `[ ] ChatGPT #4`

#### 2.2.2 WebView 인스턴스
- 선택된 서비스의 URL로 1~4개의 독립적인 BrowserView 생성
- 각 인스턴스는 **독립적인 세션**(쿠키, 로컬 스토리지)을 가질 수 있도록 고유 partition 사용
  - `persist:service-chatgpt-1`, `persist:service-chatgpt-2`, etc.
- 또는 **동일 세션 공유** 옵션 제공 (설정에서 선택)

#### 2.2.3 레이아웃 호환성
- 기존 레이아웃 (1x3, 3x1, 1x4, 2x2) 모두 지원
- 활성화된 인스턴스 수에 따라 레이아웃 버튼 활성화 조건 동일 적용

### 2.3 기존 기능 호환성 요구사항

| 기능 | 호환성 요구사항 |
|------|---------------|
| **레이아웃 선택** | 1x3, 3x1, 1x4, 2x2 모두 동작 |
| **세션 복원** | Single AI Mode 상태 및 인스턴스 복원 |
| **챗 히스토리** | 각 인스턴스별 URL 저장 및 복원, **모드 전환 포함** |
| **프롬프트 동기화** | 모든 활성 인스턴스에 동일 프롬프트 전송 |
| **파일 업로드 동기화** | 모든 활성 인스턴스에 파일 업로드 |
| **교차 검증 (Cross Check)** | 인스턴스 간 응답 비교 가능 |
| **커스텀 프롬프트 교차 검증** | 기존과 동일 |
| **마지막 응답 복사** | 모든 활성 인스턴스의 응답 복사 |
| **챗 스레드 복사** | 각 인스턴스별 스레드 복사 |
| **Anonymous Mode** | 인스턴스 이름을 (A), (B), (C), (D)로 대체 |
| **Scroll Sync** | 모든 활성 인스턴스에 스크롤 동기화 |
| **WebView 헤더 버튼** | URL 복사, Chrome에서 열기, 새로고침, 홈 등 모두 동작 |
| **New Chat** | 모든 활성 인스턴스 리셋 |

### 2.4 히스토리 세션 복원 시 모드 전환

#### 2.4.1 시나리오별 동작

| 현재 모드 | 복원할 세션 모드 | 동작 |
|----------|----------------|------|
| Multi AI | Multi AI | 서비스/URL 복원 (모드 변경 없음) |
| Multi AI | Single AI | **Single AI Mode로 전환** + 인스턴스 복원 |
| Single AI | Multi AI | **Multi AI Mode로 전환** + 서비스 복원 |
| Single AI | Single AI (동일 서비스) | 인스턴스/URL 복원 (모드 변경 없음) |
| Single AI | Single AI (다른 서비스) | **서비스 변경** + 인스턴스 복원 |
| Any | Legacy (chatMode 없음) | **Multi AI Mode로 처리** |

#### 2.4.2 레거시 세션 호환성
- 기존 IndexedDB에 저장된 세션 중 `chatMode` 필드가 없는 경우
- 해당 세션은 **Multi AI Mode**로 간주하여 복원
- `activeServices` 필드를 사용하여 서비스 활성화

#### 2.4.3 UI 표시
- 히스토리 사이드바에서 각 세션의 모드를 시각적으로 표시
  - Multi AI 세션: 기본 표시 또는 아이콘 없음
  - Single AI 세션: 해당 AI 서비스 아이콘 표시 또는 "Single" 배지

#### 2.4.4 모드 전환 시 확인 (선택적)
- 모드가 변경되는 세션 복원 시 사용자 확인 다이얼로그 표시 가능
- "이 세션은 Single AI Mode (ChatGPT)로 저장되었습니다. 복원하시겠습니까?"
- 설정에서 확인 다이얼로그 비활성화 옵션 제공

---

## 3. Technical Architecture (기술 아키텍처)

### 3.1 State Management (상태 관리)

#### 3.1.1 새로운 상태 변수
```javascript
// renderer.js
let chatMode = 'multi'; // 'multi' | 'single'
let singleAiService = null; // 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity' | 'genspark'
let singleAiInstanceCount = 4; // 1-4
let singleAiActiveInstances = [true, true, true, true]; // 각 인스턴스 활성화 상태
```

#### 3.1.2 세션 상태 스키마 확장
```json
{
  "version": 2,
  "chatMode": "single",
  "singleAiConfig": {
    "service": "chatgpt",
    "activeInstances": [true, true, false, false],
    "urls": {
      "chatgpt-1": "https://chatgpt.com/c/abc123",
      "chatgpt-2": "https://chatgpt.com/c/def456"
    }
  },
  "multiAiConfig": {
    "activeServices": ["chatgpt", "claude", "gemini", "perplexity"],
    "urls": { ... }
  },
  "layout": "2x2",
  "controls": {
    "anonymousMode": false,
    "scrollSync": true
  }
}
```

### 3.2 Main Process Changes (main.js)

#### 3.2.1 BrowserView 관리
```javascript
// Single AI Mode용 views
const singleModeViews = {}; // { 'chatgpt-1': view, 'chatgpt-2': view, ... }

// 기존 views는 Multi AI Mode용
const views = {}; // { 'chatgpt': view, 'claude': view, ... }
```

#### 3.2.2 새로운 IPC 핸들러
```javascript
// 모드 전환
ipcMain.handle('set-chat-mode', async (event, mode) => { ... });

// Single AI 설정
ipcMain.handle('set-single-ai-config', async (event, config) => { ... });

// 인스턴스 토글
ipcMain.on('toggle-single-instance', (event, instanceIndex, enabled) => { ... });
```

#### 3.2.3 Partition 전략
```javascript
// Single AI Mode에서 인스턴스별 독립 세션
function getSingleModePartition(service, instanceIndex, shareSession = true) {
    if (shareSession) {
        return `persist:service-${service}`; // 세션 공유
    }
    return `persist:service-${service}-${instanceIndex}`; // 독립 세션
}
```

### 3.3 Renderer Process Changes (renderer.js)

#### 3.3.1 토글 영역 동적 렌더링
```javascript
function renderToggleArea() {
    const togglesContent = document.querySelector('.toggles-content');
    
    if (chatMode === 'multi') {
        renderMultiAiToggles(togglesContent);
    } else {
        renderSingleAiToggles(togglesContent);
    }
}

function renderSingleAiToggles(container) {
    const service = singleAiService;
    const icon = SERVICE_ICONS[service];
    const name = SERVICE_NAMES[service];
    
    // 인스턴스 토글 생성
    for (let i = 0; i < 4; i++) {
        const label = document.createElement('label');
        label.className = 'service-toggle-label';
        label.innerHTML = `
            <input type="checkbox" id="toggle-single-${i}" ${singleAiActiveInstances[i] ? 'checked' : ''}>
            <span class="label-text">
                <span class="service-icon-wrapper">${icon}</span>
                ${isAnonymousMode ? `(${String.fromCharCode(65 + i)})` : `#${i + 1}`}
            </span>
        `;
        container.appendChild(label);
    }
}
```

#### 3.3.2 설정 모달 HTML 추가
```html
<!-- Chat Mode Settings Modal -->
<div id="chat-mode-modal" class="modal">
    <div class="modal-content chat-mode-content">
        <div class="modal-header">
            <h2>Chat Mode Settings</h2>
            <button id="close-chat-mode-btn" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="mode-options">
                <button id="btn-multi-ai-mode" class="mode-card active">
                    <div class="mode-icon">🔀</div>
                    <h3>Multi AI</h3>
                    <p>Use multiple AI services together</p>
                </button>
                <button id="btn-single-ai-mode" class="mode-card">
                    <div class="mode-icon">🎯</div>
                    <h3>Single AI</h3>
                    <p>Use one AI service in multiple views</p>
                </button>
            </div>
            
            <!-- Single AI Service Selection (hidden by default) -->
            <div id="single-ai-selection" class="hidden">
                <h4>Select AI Service</h4>
                <div class="service-grid">
                    <!-- Service icons will be rendered here -->
                </div>
                <button id="btn-apply-single-ai" class="btn-primary">Apply</button>
            </div>
        </div>
    </div>
</div>
```

### 3.4 Prompt & File Upload 호환

#### 3.4.1 프롬프트 전송 수정
```javascript
function sendPrompt(text, files) {
    if (chatMode === 'single') {
        const activeInstances = singleAiActiveInstances
            .map((active, i) => active ? `${singleAiService}-${i}` : null)
            .filter(Boolean);
        
        window.electronAPI.sendPromptToInstances(text, activeInstances, files);
    } else {
        const activeServices = Object.entries(toggles)
            .filter(([_, t]) => t.checked)
            .map(([k]) => k);
        
        window.electronAPI.sendPrompt(text, activeServices, files);
    }
}
```

### 3.5 Cross Check 호환

#### 3.5.1 인스턴스 간 응답 비교
```javascript
function buildCrossCheckPrompt() {
    if (chatMode === 'single') {
        // 동일 AI의 인스턴스 응답 비교
        const responses = await getInstanceResponses();
        
        let prompt = "Below are responses from multiple instances of the same AI:\n\n";
        responses.forEach((resp, i) => {
            const label = isAnonymousMode ? `(${String.fromCharCode(65 + i)})` : `Instance #${i + 1}`;
            prompt += `### ${label}\n${resp}\n\n`;
        });
        prompt += "Please compare and analyze these responses...";
        
        return prompt;
    }
    // 기존 Multi AI Mode 로직
}
```

### 3.6 히스토리 세션 복원 시 모드 전환

#### 3.6.1 세션 복원 로직
```javascript
async function restoreHistorySession(session) {
    // 1. 세션의 chatMode 확인 (레거시 세션은 'multi'로 처리)
    const sessionMode = session.chatMode || 'multi';
    
    // 2. 현재 모드와 다르면 모드 전환
    if (sessionMode !== chatMode) {
        await switchChatMode(sessionMode, session);
    }
    
    // 3. 모드에 따른 상태 복원
    if (sessionMode === 'single') {
        // Single AI Mode 복원
        singleAiService = session.singleAiConfig.service;
        singleAiActiveInstances = session.singleAiConfig.activeInstances;
        
        // 인스턴스 URL 복원
        Object.entries(session.singleAiConfig.urls).forEach(([instanceKey, url]) => {
            window.electronAPI.navigateInstance(instanceKey, url);
        });
    } else {
        // Multi AI Mode 복원
        const activeServices = session.activeServices || session.multiAiConfig?.activeServices;
        
        // 서비스 토글 및 URL 복원
        activeServices.forEach(service => {
            toggles[service].checked = true;
            window.electronAPI.toggleService(service, true);
        });
        
        Object.entries(session.urls || session.multiAiConfig?.urls || {}).forEach(([service, url]) => {
            window.electronAPI.navigateToUrl(service, url);
        });
    }
    
    // 4. 공통 상태 복원 (레이아웃, Anonymous, Scroll Sync 등)
    restoreCommonState(session);
}
```

#### 3.6.2 레거시 세션 감지 및 마이그레이션
```javascript
function normalizeSessionData(session) {
    // chatMode 필드가 없는 레거시 세션 처리
    if (!session.chatMode) {
        return {
            ...session,
            chatMode: 'multi',
            multiAiConfig: {
                activeServices: session.activeServices || [],
                urls: session.urls || {}
            },
            singleAiConfig: null
        };
    }
    return session;
}
```

#### 3.6.3 히스토리 아이템 모드 표시
```javascript
function renderHistoryItem(session) {
    const modeIndicator = session.chatMode === 'single' 
        ? `<span class="mode-badge single">${SERVICE_ICONS[session.singleAiConfig.service]}</span>`
        : '';
    
    return `
        <div class="history-item" data-id="${session.id}">
            ${modeIndicator}
            <span class="history-title">${session.title}</span>
            <span class="history-date">${formatDate(session.updatedAt)}</span>
        </div>
    `;
}
```

---

## 4. UI/UX Design Details (UI/UX 상세)

### 4.1 Settings Gear Icon

```html
<button id="chat-mode-settings-btn" class="icon-btn settings-btn" title="Chat Mode Settings">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
</button>
```

### 4.2 Mode Selection Cards CSS

```css
.mode-options {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding: 20px 0;
}

.mode-card {
    flex: 1;
    max-width: 200px;
    padding: 24px 16px;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
}

.mode-card:hover {
    border-color: var(--primary);
    background: var(--muted);
}

.mode-card.active {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
}

.mode-card .mode-icon {
    font-size: 32px;
    margin-bottom: 12px;
}

.mode-card h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
}

.mode-card p {
    margin: 0;
    font-size: 12px;
    color: var(--muted-foreground);
}
```

### 4.3 Service Selection Grid

```css
.service-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 16px 0;
}

.service-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s ease;
}

.service-option:hover {
    border-color: var(--primary);
}

.service-option.selected {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
}

.service-option .service-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 8px;
}

.service-option .service-name {
    font-size: 12px;
    font-weight: 500;
}
```

---

## 5. Implementation Plan (구현 계획)

### Phase 1: Core Infrastructure (핵심 인프라)
1. **상태 관리 확장**
   - `chatMode`, `singleAiService`, `singleAiActiveInstances` 상태 추가
   - 세션 저장/복원 로직 확장

2. **Main Process 수정**
   - Single AI Mode용 BrowserView 관리 로직
   - 새로운 IPC 핸들러 추가
   - Partition 전략 구현

### Phase 2: UI Components (UI 컴포넌트)
3. **Settings 버튼 추가**
   - 토글 영역에 기어 아이콘 버튼 추가
   - CSS 스타일링

4. **Mode Settings Modal 구현**
   - 모달 HTML 구조
   - 모드 선택 카드
   - 서비스 선택 그리드

5. **Dynamic Toggle Rendering**
   - 모드에 따른 토글 영역 동적 렌더링
   - Single AI Mode 인스턴스 토글

### Phase 3: Feature Integration (기능 통합)
6. **프롬프트/파일 업로드 통합**
   - Single AI Mode 프롬프트 전송 로직
   - 파일 업로드 동기화

7. **Cross Check 통합**
   - 인스턴스 간 응답 비교 로직
   - Anonymous Mode 호환

8. **WebView 헤더 기능 통합**
   - URL 표시, 복사, 외부 열기 등

### Phase 4: Testing & Polish (테스트 및 마무리)
9. **통합 테스트**
   - 모드 전환 테스트
   - 세션 복원 테스트
   - 모든 기존 기능 호환성 테스트

10. **UI 개선**
    - 애니메이션 추가
    - 접근성 개선

---

## 6. Constraints & Considerations (제약 및 고려사항)

### 6.1 Technical Constraints
- **메모리 사용량**: 동일 서비스의 여러 BrowserView는 메모리 증가 유발
- **세션 격리 vs 공유**: 독립 세션 시 각각 로그인 필요, 공유 세션 시 쿠키 충돌 가능성
- **Rate Limiting**: 일부 AI 서비스는 동시 다중 요청에 제한이 있을 수 있음

### 6.2 UX Considerations
- **모드 전환 시 데이터 손실**: 모드 전환 시 현재 채팅 컨텍스트 보존 방안 필요
- **혼란 방지**: Multi/Single 모드 간 명확한 시각적 구분
- **기본값**: 기존 사용자를 위해 Multi AI Mode가 기본값

### 6.3 Backward Compatibility
- 기존 세션 데이터는 Multi AI Mode로 간주
- 이전 버전 앱과의 세션 호환성 유지

---

## 7. Verification Plan (검증 계획)

### 7.1 Functional Testing
- [ ] Settings 버튼 클릭 시 모달 표시
- [ ] Multi AI Mode 선택 시 기존 UI로 복원
- [ ] Single AI Mode에서 서비스 선택 후 적용 시 토글 UI 변경
- [ ] Single AI Mode에서 인스턴스 토글 ON/OFF 동작
- [ ] 프롬프트 전송이 모든 활성 인스턴스에 전달
- [ ] 파일 업로드가 모든 활성 인스턴스에 전달
- [ ] Cross Check이 인스턴스 간 응답 비교 수행
- [ ] Anonymous Mode에서 인스턴스 레이블이 (A), (B), (C), (D)로 표시

### 7.2 Compatibility Testing
- [ ] 레이아웃 변경 (1x3, 3x1, 1x4, 2x2) 정상 동작
- [ ] 세션 저장 및 복원 정상 동작
- [ ] New Chat 버튼 동작
- [ ] History 사이드바 동작
- [ ] WebView 헤더 버튼들 동작

### 7.3 히스토리 세션 복원 테스트
- [ ] Multi AI Mode에서 Multi AI 세션 복원 시 정상 동작
- [ ] Multi AI Mode에서 Single AI 세션 복원 시 모드 전환 및 인스턴스 복원
- [ ] Single AI Mode에서 Multi AI 세션 복원 시 모드 전환 및 서비스 복원
- [ ] Single AI Mode에서 동일 서비스 Single AI 세션 복원 시 정상 동작
- [ ] Single AI Mode에서 다른 서비스 Single AI 세션 복원 시 서비스 변경
- [ ] 레거시 세션 (chatMode 필드 없음) 복원 시 Multi AI Mode로 처리
- [ ] 히스토리 사이드바에서 Single AI 세션에 모드 표시 (아이콘/배지)
- [ ] 모드 전환 시 확인 다이얼로그 표시 (설정에 따라)

### 7.4 Edge Cases
- [ ] Single AI Mode에서 인스턴스 0개 선택 시 처리
- [ ] 모드 전환 중 프롬프트 전송 시 처리
- [ ] 앱 재시작 시 Single AI Mode 상태 복원
- [ ] 히스토리 세션의 singleAiConfig.service가 현재 지원하지 않는 서비스인 경우 처리
- [ ] 히스토리 세션 복원 중 오류 발생 시 롤백 처리

---

## 8. Timeline (일정)

| Phase | 기간 | 설명 |
|-------|------|------|
| Phase 1 | 2일 | 핵심 인프라 (상태 관리, Main Process) |
| Phase 2 | 2일 | UI 컴포넌트 (모달, 토글 렌더링) |
| Phase 3 | 2일 | 기능 통합 (프롬프트, Cross Check 등) |
| Phase 4 | 1일 | 테스트 및 마무리 |
| **Total** | **7일** | |

---

## 9. Future Enhancements (향후 개선 방향)

1. **세션 공유 옵션**: 인스턴스 간 로그인 세션 공유 여부 선택
2. **인스턴스별 커스텀 시스템 프롬프트**: 각 인스턴스에 다른 페르소나 설정
3. **프리셋 저장**: 자주 사용하는 모드/서비스 조합 저장
4. **하이브리드 모드**: Single AI와 Multi AI 혼합 사용 (예: ChatGPT 2개 + Claude 1개)

---

## 10. Implementation Date

**계획일**: 2026-01-08  
**목표 버전**: v0.6.0

