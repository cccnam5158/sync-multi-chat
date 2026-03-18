# Main Input Prompt UX 개선 아이데이션 (Prompt Builder 연동 중심)

> 작성일: 2026-02-11  
> 대상: 메인 입력창에서 Custom Prompt Builder 자산(프롬프트/변수/프리뷰)을 끊김 없이 호출/실행하는 UX

---

## 1. 목적과 범위

현재 워크플로우는 `Custom Prompt Builder`와 메인 입력 화면 사이의 왕복(화면 전환, 복사/붙여넣기, 변수 수동 치환) 비용이 큽니다.  
본 문서는 Service A/B/C/E에서 제안된 아이디어를 통합해, **메인 화면에서 즉시 탐색/삽입/실행** 가능한 UX 개선안을 정리합니다.

- 포함:
  - Prompt Quick Access (검색/즐겨찾기/최근)
  - Slash Command(`/`) + 변수 인라인 편집
  - Insert / Insert & Run 분리
  - 시스템 변수(`{{all_responses}}`, `{{last_response.*}}`) 확장 제안
  - 단계별 구현 우선순위와 검증 지표
- 제외:
  - 실제 코드 구현
  - spec 확정 전 UI/데이터 모델 동결

---

## 2. 현 상태 Pain Point

1. 메인 입력창에서 저장 프롬프트 호출 경로가 길다.
2. 변수 기반 프롬프트 사용 시 값 입력/검증이 분리되어 재작업이 발생한다.
3. 멀티 응답 결과를 다음 프롬프트에 재사용할 때 수동 복사 작업이 잦다.
4. 즉시 실행과 편집 실행의 의도가 동일 버튼에 섞여 있어 실수 가능성이 있다.

---

## 3. 아이디어 통합 결과 (Service A/B/C/E)

## 3.1 핵심 방향

- **Recognition 우선**: 메인 화면에서 바로 찾고 고른다 (Drawer/Bar/Slash)
- **Variable First**: 삽입 시 자동으로 변수 누락을 안내하고 채운다
- **Run Intent 분리**: 편집 목적(Insert)과 즉시 실행(Insert & Run)을 분리한다
- **멀티모델 특화 자동화**: 응답 컨텍스트를 시스템 변수로 자동 바인딩한다

## 3.2 제안 패턴 묶음

### A) Prompt Launcher Layer (메인 화면 내 호출 계층)
- Prompt Drawer (접이식)
  - 검색, 태그, 최근, 즐겨찾기, 프로젝트 필터
  - 우측 미니 프리뷰 + `Insert` / `Insert & Run`
- Pinned Prompt Bar
  - 상단 칩 형태 5~8개 고정
  - 짧은 프롬프트는 즉시 삽입, 긴 프롬프트는 팝오버 프리뷰
- Slash Command
  - `/p` 프롬프트 검색, `@prompt:` 별칭 호출
  - 키보드 중심 워크플로우(Enter 삽입, Shift+Enter 삽입+전송)

### B) Variable Inline Orchestration (변수 인라인 오케스트레이션)
- 변수 감지 기반 미니 폼 자동 생성 (`{{role}}`, `{{lang}}`, `{{output_format}}` 등)
- 값 우선순위 제안:
  1) Prompt Local  
  2) Session/Project  
  3) Global  
  4) Recent Value
- 미해결 변수 경고:
  - 전송 버튼 옆 배지 + 클릭 시 해당 변수로 포커스 점프
- 치환 모드:
  - 즉시 렌더링 모드
  - 토큰 유지 모드(`{{var}}` 유지 후 전송 전 확인)

### C) 멀티 응답 재활용 시스템 변수
- `{{last_response.A}}`, `{{last_response.B}}`, ...
- `{{all_responses}}`
- `{{diff_summary}}`
- `{{chat_thread}}`
- `{{selected_text}}`

> 이 항목은 기존 `{{chat_thread}}`, `{{last_response}}` 사용 경험을 확장해  
> “복사-붙여넣기 제거”를 목표로 하는 고효율 개선 포인트입니다.

---

## 4. 추천 사용자 플로우 (Draft)

## 4.1 플로우 A - Quick Run (1~2 클릭)
1. 상단 Pinned Prompt 칩 선택
2. 변수 없으면 즉시 전송, 있으면 미니 폼 1회 입력
3. 전송 후 각 응답 카드에 프롬프트 라벨 표시

## 4.2 플로우 B - Power User Keyboard
1. 메인 입력창에서 `/p` 입력
2. 방향키로 프롬프트 선택
3. `Enter=Insert`, `Shift+Enter=Insert & Run`

## 4.3 플로우 C - Cross-check 연계
1. 비교/평가형 프롬프트 선택
2. `{{all_responses}}` 자동 주입
3. Run 이후 Cross Check 액션 자동 트리거(옵션)

---

## 5. IA/컴포넌트 초안

## 5.1 렌더러 UI 컴포넌트
- `PromptLauncherDrawer`
- `PinnedPromptBar`
- `SlashCommandPalette`
- `VariableInlinePanel`
- `PromptRunModeToggle` (`Insert` / `Insert & Run`)

## 5.2 상태/데이터
- Prompt 메타:
  - `id`, `title`, `content`, `tags`, `favorite`, `lastUsedAt`
- 실행 프리셋(선택):
  - `targetServices`, `postAction`, `outputFormat`
- 변수 컨텍스트:
  - `globalVars`, `localVars`, `sessionVars`, `systemVars`

## 5.3 연결 예상 파일(구현 시)
- `src/renderer/renderer.js` (입력창/전송 플로우/단축키)
- `src/renderer/index.html` (Launcher/Inline 폼 영역)
- `src/renderer/styles.css` (Drawer/Palette/Chips 스타일)
- `src/renderer/custom-prompt-builder.js` (프롬프트/변수 모델 확장 연동)

---

## 6. 단계별 구현 우선순위 (Spec 전 Draft)

### Phase 1 (빠른 체감)
1. Prompt Drawer + 검색/최근/즐겨찾기
2. Insert / Insert & Run 분리

### Phase 2 (생산성 가속)
3. Slash Command(`/p`, `@prompt:`)
4. 변수 미니 폼 + 미해결 변수 경고 배지

### Phase 3 (멀티모델 강점 강화)
5. 시스템 변수 확장(`all_responses`, `last_response.*`, `diff_summary`)
6. Prompt Action 프리셋(대상 서비스/후속 액션)

---

## 7. 검증 지표 (KPI)

- Prompt 실행까지 평균 입력/클릭 단계 수
- Prompt 실행 소요 시간(Time-to-Run)
- 미해결 변수로 인한 실패율
- Builder 화면 이동 빈도(감소 목표)
- Slash/즐겨찾기 사용률(증가 목표)
- Cross Check 연계 재사용률(`{{all_responses}}` 계열)

---

## 8. Spec 작성 전 결정 필요 항목

1. 변수 우선순위를 Local 우선으로 고정할지 여부
2. `Insert & Run` 기본 단축키 확정 (`Shift+Enter` vs 별도 키)
3. 시스템 변수 출력 포맷 스키마
   - 모델명/타임스탬프/메타 포함 범위
4. Prompt Action 프리셋의 저장 단위
   - 프롬프트별 고정 vs 실행 시 임시 override
5. 초기에 Drawer 중심으로 갈지, Slash 중심으로 갈지

---

## 9. 확정 의사결정 (2026-02-11)

본 문서의 Draft 의사결정 항목 중 아래를 **구현 기준**으로 확정한다.

1. 메인 입력 프롬프트의 기존 관련 기능은 이번 작업에서 제거/수정/보완한다.
2. Prompt Quick Access 트리거는 `/` 기반 **Slash Command**로 확정한다.
3. `{{chat_thread}}`, `{{last_response}}` 등 시스템 변수 전송은 기존 CPB 전송 정책과 동일하게 유지한다.
   - 대용량 텍스트는 기존 라인/문자 임계치 정책에 따라 첨부 파일 전환
4. 변수 감지 기반 미니 폼을 메인 입력 영역에서 자동 생성한다.
5. 미해결 변수 처리 UX는 기존 "배지 경고"보다 강화한다.
   - 전송 시 미설정 변수가 있으면 영문 확인 팝업 표시
   - "설정 후 전송" 선택 시 해당 변수 편집 영역으로 즉시 포커스 이동
6. IA/UI 컴포넌트는 기존 repository 구조를 기본으로 하고, 추가 필드는 하위 호환을 유지한다.
7. 커스텀 프롬프트 전송 단축키는 기존과 동일하게 `Ctrl+Enter`를 유지한다.
8. 웹뷰 상위 레이어로 인한 팝업/컨텍스트 메뉴 가림 이슈는 기존 "웹뷰 강제 리사이즈" 방식을 폐기한다.
   - 팝업 활성 중 웹뷰 레이어를 안전하게 비노출 처리하고
   - 앱 레벨 blur/dim 처리로 상위 팝업 가시성을 보장하는 방식으로 전환

---

## 10. 결론

가장 큰 개선 효과는 **메인 화면 Prompt Launcher + 변수 인라인 처리 + Insert/Run 분리** 조합에서 발생합니다.  
우선 Phase 1~2를 spec으로 구체화하면, 사용자 체감 속도와 멀티모델 반복 작업 효율을 빠르게 끌어올릴 수 있습니다.

본 문서는 아이데이션 단계이며, 다음 단계는 기능/상태/IPC 경계를 포함한 상세 spec 정의입니다.
