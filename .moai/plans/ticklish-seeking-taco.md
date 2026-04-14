# Tile Memory Limits Exceeded 에러 분석 및 해결방안

## Context

Electron 39.2.6 기반 sync-multi-chat 앱에서 고해상도 외부 디스플레이 -> 저해상도 기본 모니터로 윈도우를 드래그할 때 다음 에러가 발생:

```
[64168:0402/170912.493409:ERROR:cc/tiles/tile_manager.cc:1003]
WARNING: tile memory limits exceeded, some content may not draw
```

---

## 원인 분석

### Chromium 타일 렌더링 시스템

Chromium은 웹 콘텐츠를 **타일(tile)** 단위로 분할하여 GPU에서 래스터화합니다. 각 타일은 256x256 또는 512x512 픽셀 크기이며, 전체 타일의 GPU 메모리 사용량에 **고정 상한(budget)** 이 존재합니다.

### 이 앱에서 문제가 되는 이유

1. **다수의 WebContentsView 동시 활성**: Multi AI 모드에서 최대 6개 서비스(`chatgpt`, `claude`, `gemini`, `grok`, `perplexity`, `genspark`)의 WebContentsView가 동시 활성화됨
   - 파일: [main.js:275](src/main/main.js#L275)

2. **DPI 전환 시 타일 재생성 오버헤드**: 
   - 고해상도(scaleFactor=2.0) -> 저해상도(scaleFactor=1.0) 전환 시, Chromium이 모든 뷰의 타일을 새 DPI로 재생성
   - 전환 과정에서 **구(old) 타일 + 신(new) 타일**이 일시적으로 공존하여 메모리 상한 초과
   - 6개 뷰 x 2배(old+new) = 약 12배의 타일 메모리가 순간적으로 필요

3. **줌 팩터 변환 로직**: 
   - [main.js:333-336](src/main/main.js#L333-L336): `(1 / scaleFactor) * currentZoomLevel`
   - 디스플레이 전환 시 zoom이 크게 변경됨 (예: 0.45 -> 0.9), 이로 인해 모든 뷰가 리렌더링

4. **300ms 디바운스의 한계**:
   - [main.js:544-550](src/main/main.js#L544-L550): `scheduleApplyZoom`이 300ms 디바운스
   - 윈도우 이동 중에 `moved` 이벤트가 연속 발생하며, 중간 상태에서 잘못된 DPI로 렌더링 시도

5. **GPU 메모리 제한 미설정**: 
   - [main.js:36](src/main/main.js#L36): GPU 관련 Chromium 플래그가 전혀 설정되지 않음
   - 기본 타일 메모리 budget이 6개 고해상도 뷰에 충분하지 않음

### 요약

> **핵심 원인**: 6개의 WebContentsView가 동시에 디스플레이 DPI 변경을 처리하면서 Chromium의 타일 메모리 budget을 순간적으로 초과. 구 타일의 해제와 신 타일의 할당이 atomic하지 않아 발생하는 과도기적(transient) 메모리 초과.

---

## 해결방안

### 방안 1: 비활성 뷰의 타일 메모리 즉시 해제 (권장 - 효과 높음)

디스플레이 전환 감지 시, **현재 보이지 않는 뷰**의 렌더링을 일시 정지하여 타일 메모리를 절약합니다.

**수정 파일**: [src/main/main.js](src/main/main.js)

```javascript
// scheduleApplyZoom 내부에서 디스플레이 변경 시 비활성 뷰 배경 스로틀링
function applyZoomToAllViews() {
    const zoom = getEffectiveZoomFactor();
    
    // 현재 보이는 뷰만 우선 업데이트, 나머지는 지연
    const visibleViews = [];
    const hiddenViews = [];
    
    services.forEach(service => {
        if (views[service]?.view && !views[service].view.webContents.isDestroyed()) {
            if (views[service].visible) {
                visibleViews.push(views[service].view);
            } else {
                hiddenViews.push(views[service].view);
            }
        }
    });
    
    // 보이는 뷰 즉시 업데이트
    visibleViews.forEach(view => view.webContents.setZoomFactor(zoom));
    
    // 숨겨진 뷰는 500ms 후 순차 업데이트 (타일 메모리 분산)
    hiddenViews.forEach((view, i) => {
        setTimeout(() => {
            if (!view.webContents.isDestroyed()) {
                view.webContents.setZoomFactor(zoom);
            }
        }, 500 + (i * 200));
    });
}
```

### 방안 2: `backgroundThrottling` 활성화 (권장 - 간단)

비활성 탭의 렌더링 빈도를 줄여 타일 메모리 사용량을 자연스럽게 감소시킵니다.

**수정 파일**: [src/main/main.js](src/main/main.js)

WebContentsView 생성 시 `backgroundThrottling: true` 확인 (기본값이지만 명시적 설정 권장):

```javascript
const view = new WebContentsView({
    webPreferences: {
        preload: path.join(__dirname, '../preload/service-preload.js'),
        partition: `persist:service-${service}`,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: true  // 비활성 뷰의 렌더링 제한
    }
});
```

### 방안 3: Chromium GPU 메모리 플래그 설정 (보조)

타일 메모리 budget을 높이거나 래스터화 전략을 조정합니다.

**수정 파일**: [src/main/main.js](src/main/main.js) (앱 초기화 부분)

```javascript
// GPU 타일 메모리 관련 최적화
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');
app.commandLine.appendSwitch('gpu-rasterization-msaa-sample-count', '0');
```

- `force-gpu-mem-available-mb`: Chromium에게 사용 가능한 GPU 메모리를 알려줌 (기본값이 낮게 감지되는 경우 도움)
- `gpu-rasterization-msaa-sample-count=0`: MSAA 비활성화로 타일당 메모리 사용량 감소

### 방안 4: 디스플레이 전환 시 일시적 뷰 숨기기 (효과 확실, 구현 복잡)

디스플레이 scaleFactor 변경 감지 시, 모든 뷰를 잠시 숨겼다가 순차적으로 복원합니다.

```javascript
screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    if (changedMetrics.includes('scaleFactor')) {
        // 모든 뷰를 일시적으로 크기 0으로 설정 (타일 해제)
        hideAllViews();
        
        // 새 DPI로 줌 적용 후 순차 복원
        setTimeout(() => {
            applyZoomToAllViews();
            restoreAllViewsSequentially(); // 200ms 간격으로 하나씩 복원
        }, 100);
    }
});
```

---

## 권장 적용 순서

| 순서 | 방안 | 난이도 | 효과 | 비고 |
|------|------|--------|------|------|
| 1 | 방안 3: GPU 메모리 플래그 | 낮음 | 중간 | 2줄 추가로 즉시 적용 가능 |
| 2 | 방안 1: 비활성 뷰 지연 업데이트 | 중간 | 높음 | `applyZoomToAllViews` 수정 |
| 3 | 방안 2: backgroundThrottling | 낮음 | 중간 | 기본값이나 명시적 설정 |
| 4 | 방안 4: 뷰 순차 복원 | 높음 | 매우 높음 | UX 영향 고려 필요 |

---

## 수정 대상 파일

- [src/main/main.js](src/main/main.js) - 유일한 수정 대상

### 수정 위치

1. **Line 36 부근**: GPU 플래그 추가 (방안 3)
2. **Line 339-352**: `applyZoomToAllViews()` 함수 수정 (방안 1)
3. **Line 703-713, 1182-1191**: WebContentsView 생성 시 `backgroundThrottling` 추가 (방안 2)
4. **Line 544-560**: `scheduleApplyZoom` 및 디스플레이 변경 핸들러 개선 (방안 4)

---

## 검증 방법

1. 외부 고해상도 모니터 연결 (scaleFactor 2.0)
2. 앱을 외부 모니터에서 실행
3. Multi AI 모드에서 6개 서비스 활성화
4. 앱 윈도우를 기본 모니터(scaleFactor 1.0)로 드래그
5. Console에서 "tile memory limits exceeded" 로그 확인 여부
6. 콘텐츠가 정상 렌더링되는지 시각적 확인

---

## 참고: 이 에러의 심각도

이 WARNING은 **치명적이지 않습니다**. Chromium이 타일 메모리 상한을 초과할 때 일부 타일의 래스터화를 건너뛰는 것이며, 다음 프레임에서 정상 복구됩니다. 사용자에게는 순간적인 빈 영역(white flash)이나 깜빡임으로 나타날 수 있습니다.

다만, 6개의 동시 WebContentsView가 모두 AI 채팅 서비스를 로딩하고 있으므로 메모리 최적화는 전반적인 앱 안정성에 도움이 됩니다.
