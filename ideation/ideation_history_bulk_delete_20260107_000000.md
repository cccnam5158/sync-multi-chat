# Ideation: Conversation History Bulk Selection & Delete (Multi-Select)

## 1. Goal
Conversation History Sidebar에서 **챗 세션을 복수개 선택하여 삭제**할 수 있게 한다.

- 기본 UX(단일 클릭 = 세션 열기/복원)를 최대한 유지한다.
- “선택(Select)”과 “열기(Open)”의 충돌로 인한 오작동을 방지한다(실수로 세션이 열리거나 삭제되는 문제).
- 많은 히스토리(무한 스크롤/페이지 로딩)에서도 안정적으로 동작한다.

## 2. Problem / UX Constraints
현재 동작:
- History Item 클릭 → 해당 세션 로드(웹뷰 이동/상태 복원)로 이어짐.

문제:
- 복수 선택을 “클릭”으로 구현하면, 기존 클릭 동작(세션 열기)과 충돌한다.
- 데스크탑 표준인 `Ctrl+Click`/`Shift+Click`만으로는 발견성이 떨어지고, 마우스/트랙패드 환경에서 실수 가능성이 있다.

## 3. Proposed UX (Recommended)
### 3.1 “선택 모드(Selection Mode)” 도입 (권장)
**기본 모드(Default)**:
- 클릭: 세션 열기(현재와 동일)
- Hover: “...” 컨텍스트 메뉴(현재와 동일)

**선택 모드(Selection Mode)**:
- 클릭: 세션 열기 대신 **선택 토글**
- 각 아이템 좌측에 체크박스 노출(또는 체크 아이콘/선택 표시)
- 상단(혹은 하단) 액션 바 노출: `Delete (N)`, `Select All`, `Cancel`

진입/이탈:
- 사이드바 헤더에 `Select`(또는 연필/체크리스트) 버튼 추가 → 선택 모드 진입
- `Cancel` 버튼 또는 `Esc` → 선택 모드 종료(선택 초기화)
- 선택 0개일 때 `Delete` 비활성화

삭제 확인:
- 기존 단건 Delete 모달과 동일한 패턴으로 **Bulk Delete 모달** 제공
- 메시지 예시:
  - 제목: `Delete selected sessions?`
  - 본문: `N개의 히스토리를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
  - 버튼: `Cancel` / `Delete (N)`

### 3.2 보조 UX(옵션)
선택 모드가 있어도 파워유저를 위해 아래를 “옵션”으로 제공할 수 있다.
- `Ctrl+Click`: 기본 모드에서도 “선택 모드로 자동 진입 + 해당 아이템 선택”
- `Shift+Click`: 선택 모드에서 범위 선택(마지막 선택 앵커 기준)

> 단, 옵션 UX는 구현 복잡도가 올라가므로 1차는 “선택 모드”만으로도 충분.

## 4. UI Components
### 4.1 Sidebar Header
- 기존: 햄버거 + “Chat History”
- 추가(권장):
  - `Select` 버튼(아이콘 버튼)
  - 선택 모드일 때는 `Cancel`로 표시 변경

### 4.2 History Item
기본 모드:
- 기존과 동일(클릭=열기, ... 메뉴)

선택 모드:
- 좌측 체크박스(선택/해제)
- 선택된 항목은 배경/테두리 강조(현재 active 스타일과 구분 필요)
  - 예: active=현재 세션, selected=삭제 대상(두 상태가 겹칠 수 있음)

### 4.3 Bulk Action Bar (추천 위치: sidebar footer 위)
- `Delete (N)` (Danger 스타일)
- `Select All` / `Clear`(선택 해제)
- 선택 개수 표시

## 5. Functional Logic (High-Level)
상태:
- `isSelectionMode: boolean`
- `selectedSessionIds: Set<string>`
- `currentSessionId: string` (기존)

행동:
- 기본 모드에서 item click → `loadSession(session)`
- 선택 모드에서 item click → `toggleSelected(session.id)`
- `Delete (N)` → confirm modal → `deleteSessions(ids[])`
  - 삭제 완료 후:
    - 리스트 리렌더
    - 선택 상태 초기화
    - currentSessionId가 삭제된 경우의 처리:
      - 기존 “현재 세션 삭제 시 New Chat로 전환” 정책을 그대로 적용(또는 가장 최근 세션으로 이동)

스크롤/무한 로딩:
- 선택 모드에서도 무한 스크롤은 동작해야 함
- 새로 로드된 아이템도 `selectedSessionIds`에 따라 체크 표시 반영
- 대량 삭제 후 스크롤 위치:
  - UX 우선순위: “사용자가 보던 위치를 크게 흔들지 않기”
  - 삭제로 인해 리스트가 짧아지면, 가능한 범위에서 `scrollTop` 클램프

## 6. Edge Cases
- **선택 모드에서 세션 열기 방지**: 실수 방지 위해 클릭 동작 완전 분리
- **active(현재 세션) + selected(삭제 대상)** 동시 상태:
  - UI로 명확히 구분(예: active 아이콘/점 표시 + selected 체크)
  - 삭제 시 active가 포함되면 “삭제 후 New Chat로 전환”을 모달에 명시
- **무한 스크롤 중 삭제**:
  - 로딩 중 삭제를 막거나(버튼 disabled) 요청 큐잉
- **검색/정렬(향후)**:
  - 선택 모드에서 필터/정렬 변경 시 선택 유지 정책 정의

## 7. Implementation Notes (Non-Code)
- 단건 삭제는 현재 `deleteSession(id)` 기반. Bulk는:
  - 단순 반복 호출(1차 MVP)
  - 또는 IndexedDB transaction 단위 delete(성능 개선)
- 모달/액션 바는 현재 UI 패턴(단건 delete modal)과 동일한 스타일/레이어 정책 준수

## 8. Verification Checklist
- 기본 모드에서 기존 클릭 동작 그대로 동작
- 선택 모드 진입/해제 정상
- 선택/해제, Select All, Delete(N) 정상
- 삭제 후 currentSessionId가 포함된 경우 정책대로 동작
- 무한 스크롤 상황에서도 선택 표시/삭제 안정적
- 스크롤 위치가 과도하게 흔들리지 않음




