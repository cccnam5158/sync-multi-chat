# Plan: 빈 변수 값일 때 `{{variable_name}}` 원본 유지

## Context

메타 프롬프트 작성 시 `{{some_variable}}`을 리터럴 문자열로 전송해야 하는 경우가 있음. 현재는 변수 값이 비어있으면 빈 문자열로 치환하여 `{{variable_name}}`이 사라지는 문제가 있음.

## 수정 대상

**파일:** [custom-prompt-builder.js:2010-2014](src/renderer/custom-prompt-builder.js#L2010-L2014)

`substitutePlain()` 함수 1곳만 수정

## 변경 내용

```javascript
// Before
function substitutePlain(text, map) {
    let t = text;
    for (const [k, v] of Object.entries(map)) { t = t.replaceAll(`{{${k}}}`, v); }
    return t;
}

// After
function substitutePlain(text, map) {
    let t = text;
    for (const [k, v] of Object.entries(map)) {
        if (typeof v === 'string' && !v.trim()) continue;
        t = t.replaceAll(`{{${k}}}`, v);
    }
    return t;
}
```

## 동작 변경

| 시나리오 | Before | After |
|---------|--------|-------|
| 변수 값이 빈 문자열 `""` | `{{var}}` → `` (빈 문자열) | `{{var}}` → `{{var}}` (유지) |
| 변수 값이 공백만 `"  "` | `{{var}}` → `"  "` | `{{var}}` → `{{var}}` (유지) |
| 변수 값이 있음 `"hello"` | `{{var}}` → `hello` | `{{var}}` → `hello` (동일) |

## 영향 범위

- CPB Send flow (`handleSend`) - 모두 `substitutePlain()` 경유
- Master Input Send flow (`window.sendPrompt`) - 모두 `substitutePlain()` 경유
- "Send Anyway" 버튼 - 빈 변수가 원본 유지됨 (의도된 동작)
- 시스템 변수 (`chat_thread`, `last_response`) - 비어있으면 `{{chat_thread}}`로 유지
- 모달 동작, 변수 감지 로직 - 변경 없음

## 검증

1. CPB에서 `{{test_var}}`가 포함된 프롬프트 작성
2. 변수 입력 모달에서 값을 비워둔 채 전송
3. 전송된 텍스트에 `{{test_var}}`가 그대로 포함되는지 확인
4. 값을 입력한 경우 정상적으로 치환되는지 확인
