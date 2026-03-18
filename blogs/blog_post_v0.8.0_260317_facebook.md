Sync Multi Chat v0.8.0 업데이트 안내

이번 버전의 핵심은 두 가지입니다.

1. Gemini 세션 연장 주기 완화
앱을 한동안 켜 두었을 때 Gemini 로그인이 풀리던 현상을 더 완화했습니다.
keep-alive와 idle-refresh 동작 주기를 조정해 유휴 상태에서도 세션이 덜 끊기도록 했고,
각 Gemini 패널 헤더(새로고침 버튼 왼쪽)에 "다음 연장까지 남은 시간"을 보여주는 카운트다운 타이머를 넣었습니다.
프롬프트를 보내거나 해당 패널을 새로고침하면 타이머가 리셋됩니다.

2. 프롬프트 빌더에서 Mermaid, 코드, LaTeX 라이브 프리뷰
커스텀 프롬프트 빌더와 메인 프롬프트 Live Preview에서
코드 블록(문법 강조), Mermaid 다이어그램, LaTeX 수식을 전용 섹션으로 렌더링해 바로 확인할 수 있습니다.
Mermaid는 확대/축소, 뷰 맞춤, 전체 화면 보기 버튼을 지원합니다.
플로우차트나 시퀀스 다이어그램을 프롬프트에 넣고 전송 전에 미리보기로 확인할 수 있습니다.

이미 쓰고 계시다면 앱을 재기동해서 업데이트 공지 팝업의 "지금 업데이트"로, 처음 쓰시는 분은 GitHub Releases에서 최신 인스톨러를 받으시면 됩니다.

세부 사항은 아래 링크를 확인해 주세요.
https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.8.0

다운로드는 아래 링크를 확인해 주세요.
https://cccnam5158.github.io/sync-multi-chat/#downloads
