# Mermaid 다이어그램 프리뷰 렌더링 기능

> 작성일: 2026-03-12  
> 대상: Main Prompt Preview, Prompt Builder, Custom Prompt Builder에서 ```mermaid 코드 블록을 프리뷰에 시각 렌더링

---

## 1. 목적과 범위

사용자가 메인 입력창·프롬프트 빌더·커스텀 프롬프트 빌더에서 **마크다운 코드 블록** ` ```mermaid ` … ` ``` ` 형식으로 Mermaid 다이어그램을 작성했을 때, **프리뷰 영역에서 코드가 아닌 다이어그램(SVG)으로 렌더링**되도록 한다.

- **포함**
  - Main Prompt 인라인/확장 프리뷰
  - Custom Prompt Builder Edit/Preview 모드의 Preview 영역
  - Session Custom Prompt Builder(세션 프롬프트 빌더) Preview 영역
- **제외**
  - AI 서비스 웹뷰 내부 렌더링(각 서비스 자체 동작)
  - 전송되는 텍스트 형식 변경(그대로 ```mermaid … ``` 텍스트로 전송)
- **배포 환경**
  - 앱은 **exe(NSIS 인스톨러)** 로 설치·배포되므로, **오프라인 동작**을 전제로 한다. CDN 의존 없이 번들된 라이브러리만 사용한다.

---

## 2. 현황

- **마크다운 렌더링**: `marked`로 전체 텍스트를 HTML로 변환한 뒤 프리뷰 `innerHTML`에 넣고 있음.
- **코드 블록**: ` ```mermaid ` 는 marked에 의해 `<pre><code class="language-mermaid">…</code></pre>` 로 출력됨. 현재는 일반 코드 블록처럼 스타일만 적용되고 **다이어그램으로 변환되지 않음**.
- **공통점**: 세 곳 모두 `marked.parse()` 결과 HTML을 그대로 사용하거나, 변수 치환 후 `marked.parse()`를 적용한 뒤 DOM에 넣는 구조.

---

## 3. 구현 아이디어

### 3.1 처리 흐름

1. **기존과 동일**: 변수 치환 → `marked.parse()` 로 마크다운 → HTML 문자열 생성.
2. **후처리(공통)**  
   - 생성된 HTML 문자열에서 **Mermaid 코드 블록**을 찾는다.  
   - 패턴: `<pre><code class="language-mermaid">` (또는 `class`에 `mermaid` 포함) 로 감싸진 블록.  
   - 각 블록의 **텍스트 내용**을 추출하고, 해당 `<pre>…</pre>` 를 **하나의 `<div class="mermaid">…내용…</div>`** 로 교체한다. (Mermaid 공식 권장: `div.mermaid` 안에 다이어그램 코드를 넣음.)
3. **DOM 반영 후 Mermaid 실행**  
   - 위에서 만든 HTML을 프리뷰 컨테이너에 `innerHTML` 로 넣는다.  
   - **해당 컨테이너 내부의 모든 `div.mermaid`** 에 대해 Mermaid 라이브러리의 **`mermaid.run()`** (또는 동등한 API)를 호출한다.  
   - `mermaid.run()` 은 비동기이므로, 호출 후 **Promise 완료 시점**에 렌더링이 끝난다. 필요 시 로딩/에러 UI를 넣을 수 있다.
4. **에러 처리**  
   - 문법 오류 등으로 특정 블록이 실패하면, 해당 블록만 원본 코드를 그대로 표시하거나 "Mermaid 렌더 실패" 메시지를 보여 주고, 나머지 블록은 계속 렌더링한다.

### 3.2 라이브러리 선택 및 exe 배포

- **Mermaid**: npm 패키지 `mermaid` 사용. 브라우저용 번들이 **오프라인에서 동작**하며, exe 패키징 시 **`node_modules/mermaid` 를 앱과 함께 포함**하면 된다.
- **로딩 방식**  
  - 현재 `marked` 는 `index.html` 에서 `<script src="../../node_modules/marked/...">` 로 로드하고 있음.  
  - **동일하게** `mermaid` 의 **UMD/브라우저 번들** (예: `mermaid/dist/mermaid.min.js` 또는 공식 문서 권장 스크립트 경로) 을 `index.html` 에 추가한다.  
  - electron-builder 의 `files` 에 `src/**/*` 만 있어도, **dependencies** 에 `mermaid` 를 넣으면 설치 시 `node_modules` 에 들어가고, 상대 경로로 스크립트를 불러오므로 **패키징된 exe 내부에서도 동일 경로로 접근 가능**하다. (기존 `marked` 와 동일한 방식.)
- **버전**  
  - Mermaid v10+ 의 `mermaid.run()` 사용을 권장. (async 안정화·API 정리됨.)

### 3.3 적용 위치 (3곳)

| 위치 | 파일/함수 | 시점 |
|------|-----------|------|
| Main Prompt Preview | `custom-prompt-builder.js` / `renderMasterPreview()` | `buildVariableAwarePreviewHtml()` 로 HTML 생성 후 `masterPreview.innerHTML = html` 한 직후, 해당 컨테이너에 대해 mermaid 후처리 |
| Inline Preview (동일 메인 입력) | 동일 HTML을 쓰는 인라인 프리뷰 pane | `renderMasterPreview()` 에서 한 번만 처리하면 인라인/확장 모두 같은 DOM을 쓰므로 1회 적용으로 충분 |
| Custom Prompt Builder | `custom-prompt-builder.js` / `renderPreview()` | `el.preview.innerHTML = html` 설정 직후, `el.preview` 를 루트로 mermaid 실행 |
| Session Prompt Builder | `custom-prompt-builder.js` / 세션 프롬프트 Preview 갱신 함수 | `previewEl.innerHTML = html` 직후, 해당 `previewEl` 에 대해 mermaid 실행 |

### 3.4 공통 유틸

- **함수**: 예) `renderMermaidInContainer(containerElement)`  
  - `containerElement`: 프리뷰 DOM 노드 (예: `#prompt-inline-preview-content`, `#cpb-editor-preview`, 세션 프롬프트 Preview div).  
  - 내부에서 `containerElement.querySelectorAll('.mermaid')` 로 대상을 찾고, `window.mermaid.run({ nodes: nodeList })` (또는 동일 의미 API) 호출.  
  - `mermaid` 가 로드되지 않았으면 no-op.  
  - 반환: `Promise` (모든 다이어그램 렌더 완료 또는 실패 처리 후).
- **HTML 문자열 단계에서의 치환**  
  - marked 결과 HTML 문자열에서 `<pre><code class="language-mermaid">…</code></pre>` 를 정규 또는 DOM 파서로 찾아, `<div class="mermaid">…</div>` 로 바꾸는 함수를 두고, **세 곳 모두** marked 직후·innerHTML 대입 전에 이 치환을 적용하면, DOM 반영 후 `renderMermaidInContainer` 한 번으로 통일할 수 있다.

### 3.5 스타일

- Mermaid가 생성하는 SVG/요소는 기본 테마(다크/라이트)를 적용할 수 있으면, 기존 프리뷰 테마(라이트/다크)와 맞추는 것이 좋다.  
- Mermaid 초기화 시 `theme` / `themeVariables` 설정을 넣어, 앱의 `master-preview-theme-dark` / `master-preview-theme-light` 와 유사한 배경·전경색을 주면 일관된 UX를 유지할 수 있다.

### 3.6 보안·성능

- **CSP/스크립트**: Mermaid는 SVG를 그리기 위해 DOM을 조작할 뿐, `eval` 이나 외부 스크립트 로드를 하지 않으므로, 기존 Electron 보안 설정과 충돌할 가능성은 낮다.  
- **큰 다이어그램**: 노드가 매우 많은 다이어그램은 렌더 지연이 있을 수 있으므로, `mermaid.run()` 을 `requestAnimationFrame` 이후 또는 짧은 `setTimeout` 뒤에 호출해 메인 스레드 블로킹을 줄일 수 있다.  
- **exe 용량**: mermaid 번들 크기는 수백 KB 수준이므로, 설치 용량 증가는 제한적이다.

---

## 4. 구현 체크리스트

- [ ] **package.json**  
  - `dependencies` 에 `mermaid` 추가 (버전 예: ^11 또는 ^10).
- [ ] **index.html**  
  - `mermaid` 브라우저 번들 스크립트 태그 추가 (marked 다음 등).  
  - 로드 순서: marked → mermaid → (기존) renderer, custom-prompt-builder.
- [ ] **공통 유틸**  
  - HTML 문자열 내 `language-mermaid` 코드 블록 → `div.mermaid` 치환 함수.  
  - `renderMermaidInContainer(container)` 구현 (window.mermaid.run 사용, 에러 시 해당 블록만 폴백).
- [ ] **CPB `renderPreview()`**  
  - markdown HTML 생성 후 mermaid 블록 치환 적용 → `el.preview.innerHTML` 설정 → `renderMermaidInContainer(el.preview)` 호출.
- [ ] **Main Preview `renderMasterPreview()`**  
  - `buildVariableAwarePreviewHtml()` 결과 HTML에 mermaid 치환 적용 → innerHTML 설정 → `renderMermaidInContainer(masterPreview)` 호출.  
  - 인라인/확장 프리뷰가 동일 DOM을 쓰면 한 곳만 처리.
- [ ] **Session Prompt Builder Preview**  
  - 세션 프롬프트용 Preview 갱신 시, 동일하게 mermaid 치환 후 innerHTML → `renderMermaidInContainer(previewEl)`.
- [ ] **테마**  
  - (선택) Mermaid 초기화 시 `theme: 'dark'|'base'` 등으로 프리뷰 테마와 맞추기.
- [ ] **에러 처리**  
  - `mermaid.run()` 옵션 중 `suppressErrors` 또는 개별 블록 try/catch로, 한 블록 실패 시 나머지는 그대로 표시.
- [ ] **electron-builder**  
  - 기존처럼 dependencies가 패키징되므로 별도 `files` 수정 없이 동작하는지 확인. 필요 시 `node_modules/mermaid/dist` 등이 asar에 포함되는지 확인.

---

## 5. 테스트 제안

- 메인 입력창에 ` ```mermaid \n graph LR\n A-->B \n ``` ` 입력 후 프리뷰 토글 시 다이어그램이 보이는지.
- Custom Prompt Builder에서 동일 내용 저장 후 Preview 탭에서 렌더링되는지.
- Session Prompt Builder에서 동일 내용 입력 후 Preview에서 렌더링되는지.
- Mermaid 문법 오류 블록이 있을 때 해당 블록만 실패하고 나머지 텍스트/다이어그램은 보이는지.
- exe 빌드 후 설치한 환경에서 네트워크 차단 상태로 위 시나리오 동작(오프라인) 확인.

---

## 6. 참고

- Mermaid 공식: https://mermaid.js.org/
- Marked는 코드 블록의 info string을 `language-*` 클래스로 출력: https://marked.js.org/
- Electron 앱 패키징 시 node_modules 포함: electron-builder는 production dependencies를 기본 포함.
