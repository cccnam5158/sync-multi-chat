# Ideation: 프리뷰 코드블록 별도 섹션 UI 및 제어 버튼

**날짜**: 2026-03-12  
**목적**: 첨부 이미지 및 사용자 방향성 기준으로 현재 프리뷰의 문제점을 식별하고, ``` 블록을 별도 섹션으로 구별·제어하는 수정 방안을 제안한다.

---

## 1. 현재 상태 요약

- **Prompt editor**: 마크다운 또는 일반 텍스트 입력; 중간에 ` ```lang ` 형태로 코드·mermaid·(향후 latex) 입력 가능.
- **프리뷰 파이프라인**: `extractMermaidBlocksFromMarkdown` → placeholder 치환 → `marked.parse` → `injectMermaidBlocksIntoHtml` → `renderMermaidInContainer`. Mermaid만 사전 추출·주입하고, 나머지 코드 블록은 marked가 `<pre><code class="language-xxx">` 로만 출력.
- **툴바**: 줌 아웃/인, Fit, 전체화면 버튼이 **프리뷰 영역 전체** 상단에 하나만 존재(Main 인라인, Preview 모달, CPB, Session 공통). Mermaid **블록별** 헤더/버튼은 없음.

---

## 2. 문제점 식별 (첨부 이미지 및 요구사항 기준)

### 2.1 ``` 블록이 별도 섹션으로 구별되지 않음

- **요구사항**: "중간에 ``` 블록은 첨부 이미지처럼 별도의 섹션으로 구별되어 표시. 프리뷰 영역 전체 컨텐츠에 머징되지 않고 별도 섹션 블록 내에 렌더링."
- **현재**: Mermaid는 `<div class="mermaid">` 로 삽입되지만, **카드형 래퍼(헤더+콘텐츠)** 가 없어서 "블록 종류 라벨 + 상단 제어 버튼"이 있는 독립 섹션처럼 보이지 않음. 일반 코드 블록(```python 등)은 marked 기본 `<pre><code>` 만 있어서 역시 섹션 구별이 없음.

### 2.2 Mermaid 블록 상단에 텍스트/미리보기/복사 버튼 부재

- **요구사항**: "mermaid 프리뷰 버튼 또는 토글이 활성화되어 있으면 mermaid 블록에 **텍스트/미리보기/복사** 버튼이 블록 상단에 배치. 미리보기 선택 시 코드 렌더링 + 확대/축소/Fit/Full Screen 버튼 표시. **복사 버튼은 항상 고정된 상단 오른쪽**."
- **현재**: 텍스트(원본 코드 보기)/미리보기(다이어그램 보기) 토글이 없음. 복사 버튼 없음. 줌/맞춤/전체화면은 **프리뷰 pane 전체** 상단에만 있어, "해당 Mermaid 블록만" 제어하는 블록 단위 UI가 아님.

### 2.3 일반 코드 블록(```python 등) 전용 UI 부재

- **요구사항**: "다른 코드 블록은 mermaid처럼 별도 블록 영역에 표시 + **syntax highlight** + **복사 버튼**."
- **현재**: marked가 `language-xxx` 클래스만 부여하고, **highlight.js 등 문법 강조 라이브러리 미사용**. 블록 래퍼·헤더·복사 버튼 없음.

### 2.4 LaTeX 수식 블록 미구현

- **요구사항**: "latex 수식 렌더링 블록은 mermaid처럼 구성. 미리보기 시 수식 렌더링, **이미지 export 또는 클립보드 복사**."
- **현재**: ```latex 블록에 대한 파싱·렌더링·블록 UI·내보내기/복사 기능 없음.

---

## 3. 수정 제안 방향

### 3.1 공통: ``` 블록 래퍼(섹션 블록) 도입

모든 ` ```lang ` 블록(mermaid, python, latex, js 등)을 **동일한 래퍼 구조**로 감싸서, 프리뷰에서 "블록 단위 카드"로 보이게 한다.

- **제안 HTML 구조 (개념)**  
  - 각 블록을 `<div class="prompt-block-wrapper" data-block-type="mermaid|code|latex">` 로 감싼다.
  - 내부: `prompt-block-header`(라벨 + 제어 버튼) + `prompt-block-content`(원본 코드 또는 렌더 결과).
  - **복사 버튼**은 헤더 우측 고정(`position` 또는 flex 끝)으로 항상 배치.

### 3.2 Mermaid 블록

- **헤더**: 좌측 "Mermaid" 라벨, 우측 **텍스트 / 미리보기** 토글 + **복사** 버튼(항상 상단 오른쪽).
- **콘텐츠**:
  - "텍스트": 원본 Mermaid 코드(선택 시 syntax highlight 적용 가능).
  - "미리보기": 기존처럼 `div.mermaid` 렌더링 + **해당 블록 내부**에 줌 아웃/인, Fit, 전체화면 버튼 배치(블록 단위 툴바).
- 기존 `extractMermaidBlocksFromMarkdown` / `injectMermaidBlocksIntoHtml` 를 **블록 래퍼를 포함한 HTML**을 주입하도록 확장하면, "섹션 구별"과 "블록별 툴바"를 동시에 만족시킬 수 있음.

### 3.3 일반 코드 블록(```python 등)

- **헤더**: 좌측 언어명(예: "Python"), 우측 **복사** 버튼만.
- **콘텐츠**: `<pre><code class="language-xxx">` + **syntax highlight** (예: highlight.js 또는 Prism 경량 번들). 복사 버튼 클릭 시 원본 코드를 클립보드에 복사.

### 3.4 LaTeX 블록

- **헤더**: "LaTeX" 라벨 + **텍스트 / 미리보기** 토글 + **복사(원본 코드)** + (미리보기 시) **이미지 내보내기 / 클립보드에 렌더 결과 복사**.
- **콘텐츠**: 텍스트 모드면 원본 LaTeX; 미리보기 모드면 KaTeX/MathJax 등으로 렌더링.  
  렌더 결과를 canvas/image로 만들어 다운로드 또는 `navigator.clipboard.write` 로 복사.

---

## 4. 구현 접근 (권장 순서)

1. **블록 추출·래퍼 생성 (공통)**  
   - marked 실행 **전**에 원문에서 모든 ` ```lang\n...\n``` ` 패턴을 추출.
   - lang별로:
     - **mermaid**: 기존처럼 base64 등으로 보관, 래퍼 HTML(헤더+텍스트/미리보기+복사+블록별 줌 툴바 영역+콘텐츠 placeholder) 생성.
     - **latex**: 동일하게 래퍼(헤더+텍스트/미리보기+복사+export/복사)+placeholder.
     - **그 외(code)**: 래퍼(헤더+복사)+`<pre><code class="language-xxx">` 콘텐츠(이스케이프) 삽입.
   - 추출된 블록을 `%%BLOCK_0%%` 형태 placeholder로 치환 후 marked 실행.
   - marked 결과에서 placeholder를 위에서 만든 래퍼 HTML로 치환.

2. **Mermaid 블록 UI**  
   - 래퍼 내 "미리보기" 뷰에서만 `div.mermaid` 표시 및 `mermaid.run()` 호출.
   - 래퍼 내부에 줌/맞춤/전체화면 툴바를 두고, 기존 `applyPreviewZoom` 등은 **해당 블록의 content div**만 대상으로 하도록 확장(또는 툴바별로 `data-preview-content`를 블록 content의 id/참조로 연결).

3. **일반 코드 블록**  
   - highlight.js(또는 Prism) 스크립트 추가, `language-xxx` 가 있는 `pre code` 에 대해 `hljs.highlightElement`(또는 동등) 호출.
   - 헤더 복사 버튼 클릭 시 해당 블록의 `code` 텍스트를 `navigator.clipboard.writeText` 로 복사.

4. **LaTeX 블록**  
   - KaTeX(또는 MathJax) 스크립트 추가.
   - ```latex 블록 추출 → 래퍼 주입 → 미리보기 시 KaTeX으로 렌더링.
   - 렌더된 수식 영역을 SVG/PNG로 변환해 다운로드/클립보드 복사(예: html2canvas 또는 svg export 후 canvas.toBlob).

5. **기존 "프리뷰 전체" 툴바**  
   - Main/Prompt Builder/Custom Prompt Builder 등에서, **Mermaid 블록이 하나만 있거나 전체 콘텐츠가 사실상 하나의 다이어그램일 때** 기존처럼 pane 상단 툴바를 유지할지, 아니면 모든 줌/맞춤/전체화면을 **블록 내부**로만 둘지는 정책 결정. 제안: **블록 래퍼 도입 후에는 블록 내부 툴바만 사용**하고, pane 레벨 툴바는 제거하거나 "블록이 하나일 때만" 표시하도록 단순화.

---

## 5. 적용 범위

- **Main prompt**: 인라인 프리뷰, 확장(모달) 프리뷰.
- **Custom Prompt Builder**: Preview 탭.
- **Session Prompt Builder**: Preview / Live Preview.

위 세 가지 프리뷰 경로에서 동일한 "블록 추출 → 래퍼 주입 → marked → 치환 → (mermaid/code/latex) 후처리" 파이프라인을 공유하도록 구현하면, 사용자 요청한 "별도 섹션 구별" 및 "텍스트/미리보기/복사 + (mermaid) 줌·맞춤·전체화면"을 일관되게 제공할 수 있다.

---

## 6. SRS 반영 제안

- **REQ-INPUT-021 (Preview code block sections)**: When the main prompt preview is shown, the system shall display each markdown fenced code block (e.g. ` ```mermaid `, ` ```python `, ` ```latex `) as a distinct section block with a header (block type label and controls) and content area, so that preview content is not merged into a single flow.
- **REQ-INPUT-022 (Mermaid block controls)**: For a ` ```mermaid ` block in preview, the system shall provide per-block header controls: Text/Preview toggle, Copy (raw code) button fixed at top-right; when Preview is selected, rendered diagram and Zoom out / Zoom in / Fit / Full screen buttons for that block.
- **REQ-INPUT-023 (Code block syntax and copy)**: For other language code blocks (e.g. ` ```python `) in preview, the system shall display the block in a distinct section with syntax highlighting and a Copy button that copies the raw code to the clipboard.
- **REQ-INPUT-024 (LaTeX block)**: For a ` ```latex ` block in preview, the system shall provide Text/Preview toggle and Copy; when Preview is selected, render the math and provide export as image or copy rendered result to clipboard.

(위 번호는 기존 SRS와 충돌하지 않도록 최종 조정.)

---

## 7. 정리

| 구분 | 현재 문제 | 제안 방향 |
|------|-----------|-----------|
| 섹션 구별 | ``` 블록이 프리뷰에 한 흐름으로 머징됨 | 모든 ``` 블록을 prompt-block-wrapper 로 감싼 별도 섹션으로 표시 |
| Mermaid | 블록 상단 텍스트/미리보기/복사 없음; 줌 툴바는 pane 전체용 | 블록별 헤더(텍스트/미리보기/복사), 미리보기 시 블록 내 줌/맞춤/전체화면 |
| 복사 위치 | 없음 | 모든 블록 타입에서 복사 버튼을 헤더 우측 고정 |
| 일반 코드 | 문법 강조·복사 없음 | syntax highlight + 헤더 복사 버튼 |
| LaTeX | 미구현 | 블록 래퍼 + 텍스트/미리보기 + 렌더 + 이미지 export/클립보드 복사 |

이 방향으로 구현 시, 첨부 이미지에서 기대하는 "별도 섹션 + 상단 제어 버튼" UX와 사용자 제시 방향성을 충족할 수 있다.
