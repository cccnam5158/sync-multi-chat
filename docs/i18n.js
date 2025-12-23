/**
 * Internationalization (i18n) for Sync Multi Chat Website
 * Supports: English (en), Korean (ko), Japanese (ja)
 */

const translations = {
    en: {
        // Navigation
        "nav.features": "Features",
        "nav.useCases": "Use Cases",
        "nav.howItWorks": "How it Works",
        "nav.downloads": "Downloads",
        "nav.releaseNotes": "Release Notes",
        "nav.getStarted": "Get Started",

        // Hero Section
        "hero.badge": "New: Genspark Integration Added",
        "hero.title1": "One Prompt.",
        "hero.title2": "Six Minds Simultaneously.",
        "hero.tagline": "Stop switching tabs. Broadcast your prompts to ChatGPT, Claude, Gemini, Grok, Perplexity, and Genspark at once. Compare, cross-check, and iterate faster.",
        "hero.downloadBtn": "Download for Desktop",
        "hero.githubBtn": "View on GitHub",

        // Features Section
        "features.title": "Powerful Features for Power Users",
        "features.tagline": "Everything you need to orchestrate the world's most capable AI models.",
        "features.multiPane.title": "Flexible Multi-Pane UI",
        "features.multiPane.desc": "Interact with up to 4 services at once. Choose from 2x2, 1x3, 1x4, or specialized vertical layouts that sync with your workflow.",
        "features.simultaneous.title": "Simultaneous Prompting",
        "features.simultaneous.desc": "Type once, send everywhere. A central input bar allows you to broadcast messages to all active services instantly.",
        "features.crossCheck.title": "AI Cross-Check",
        "features.crossCheck.desc": "Let the AIs review each other. One click to have each service analyze and compare the responses provided by the others.",
        "features.session.title": "Session Persistence",
        "features.session.desc": "Your environment is saved automatically. Restore layouts, active services, and specific URLs exactly where you left off.",
        "features.privacy.title": "Privacy First",
        "features.privacy.desc": "Direct login to official services. No middleman, no credential storage. Your sessions run in isolated sandboxed environments.",
        "features.fileUpload.title": "Universal File Support",
        "features.fileUpload.desc": "Drag & drop or paste images and text. Upload to multiple AIs simultaneously with a verified two-step workflow.",

        // Comparison Section
        "comparison.title": "Designed for Seamless Comparison",
        "comparison.scrollSync": "Scroll Sync",
        "comparison.scrollSyncDesc": "Scroll one panel, and all others follow.",
        "comparison.anonymous": "Anonymous Mode",
        "comparison.anonymousDesc": "Hide AI names during comparisons to reduce bias.",
        "comparison.markdown": "Markdown Copy",
        "comparison.markdownDesc": "Copy entire threads or just last responses with one click.",

        // Download Section
        "download.title": "Start Broadcasting Today",
        "download.tagline": "Download for your preferred platform. Open-source and non-commercial.",
        "download.windows": "Windows",
        "download.windowsDesc": "v0.5.6 | Portable EXE & Installer",
        "download.downloadExe": "Download .exe",
        "download.macos": "macOS",
        "download.comingSoon": "Coming Soon",
        "download.chrome": "Chrome Extension",
        "download.chromeDesc": "Coming Soon to Web Store",

        // Footer
        "footer.tagline": "The ultimate browser for AI power users.",
        "footer.product": "Product",
        "footer.resources": "Resources",
        "footer.documentation": "Documentation",
        "footer.reportIssue": "Report Issue",
        "footer.community": "Community",
        "footer.updates": "Updates",
        "footer.copyright": "2025 Joseph Nam. Polyform Noncommercial License 1.0.0.",

        // Use Cases Page
        "useCases.hero.title1": "Which",
        "useCases.hero.title2": "Workflow",
        "useCases.hero.title3": "Will You Transform?",
        "useCases.hero.tagline": "Explore proven scenarios from real users and accelerate your AI-powered productivity.",
        "useCases.roles.research": "Research & Analysis",
        "useCases.roles.creator": "Content Creation",
        "useCases.roles.business": "Business Strategy",
        "useCases.roles.educator": "Education",
        "useCases.roles.developer": "Development",

        // Researcher Section
        "useCases.researcher.title": "Researcher & Analyst",
        "useCases.researcher.tagline": "Deep dive into complex topics with multi-perspective analysis",
        "useCases.researcher.scenarioA.title": "Multi-Angle Document Analysis",
        "useCases.researcher.scenarioA.desc": "Analyze 100+ page reports from multiple perspectives simultaneously",
        "useCases.researcher.scenarioA.metric1": "Time Saved",
        "useCases.researcher.scenarioA.metric2": "Fewer Blind Spots",
        "useCases.researcher.scenarioB.title": "Accelerated Learning Loop",
        "useCases.researcher.scenarioB.desc": "Chain questions to rapidly build knowledge structures",
        "useCases.researcher.scenarioB.metric1": "Knowledge Speed",

        // Creator Section
        "useCases.creator.title": "Content Creator & Writer",
        "useCases.creator.tagline": "Master prompt engineering and optimize content quality",
        "useCases.creator.scenarioC.title": "Optimal Prompt Engineering",
        "useCases.creator.scenarioC.desc": "Discover each AI's strengths and create hybrid prompts",
        "useCases.creator.scenarioC.metric1": "Quality Boost",
        "useCases.creator.scenarioC.metric2": "Faster Iteration",
        "useCases.creator.scenarioD.title": "A/B Testing at Scale",
        "useCases.creator.scenarioD.desc": "Compare marketing copy variations instantly",
        "useCases.creator.scenarioD.metric1": "Saved/Project",

        // Business Section
        "useCases.business.title": "Business Decision Maker",
        "useCases.business.tagline": "Reduce blind spots and validate decisions with multi-AI perspectives",
        "useCases.business.scenarioE.title": "Risk Analysis & Devil's Advocate",
        "useCases.business.scenarioE.desc": "Collect opposing viewpoints before major decisions",
        "useCases.business.scenarioE.metric1": "More Counter-Args",
        "useCases.business.scenarioF.title": "Competitive Intelligence",
        "useCases.business.scenarioF.desc": "Analyze competitor strategies in hours, not weeks",
        "useCases.business.scenarioF.metric1": "Faster Insights",

        // Educator Section
        "useCases.educator.title": "Educator & Trainer",
        "useCases.educator.tagline": "Generate multi-level explanations for diverse audiences",
        "useCases.educator.scenarioG.title": "Multi-Level Content Generation",
        "useCases.educator.scenarioG.desc": "Create explanations from elementary to expert level",
        "useCases.educator.scenarioG.metric1": "Comprehension+",
        "useCases.educator.scenarioG.metric2": "Difficulty Levels",

        // Developer Section
        "useCases.developer.title": "Developer & Engineer",
        "useCases.developer.tagline": "Democratize code review with multi-AI analysis",
        "useCases.developer.scenarioH.title": "Multi-AI Code Review",
        "useCases.developer.scenarioH.desc": "Find more bugs with collective AI intelligence",
        "useCases.developer.scenarioH.metric1": "More Bugs Found",
        "useCases.developer.scenarioH.metric2": "Avg Issues vs 6",

        // CTA
        "cta.title": "Ready to Transform Your Workflow?",
        "cta.tagline": "Download Sync Multi Chat and experience the power of multi-AI orchestration.",
        "cta.downloadBtn": "Download Free",

        // Release Notes
        "releaseNotes.title": "Release History",
        "releaseNotes.lastUpdated": "Last updated: Dec 18, 2025",
        "releaseNotes.current": "Current",
        "releaseNotes.newFeatures": "New Features",
        "releaseNotes.v056.feature1": "Genspark Integration: Full support for search-driven AI chat.",
        "releaseNotes.v056.feature2": "Anonymous Mapping: Maps Genspark to alias \"(F)\".",
        "releaseNotes.v055.title": "Conversation History",
        "releaseNotes.v055.feature1": "New collapsible sidebar for easy history access.",
        "releaseNotes.v055.feature2": "Auto-Save functionality for sessions, layouts, and URLs.",
        "releaseNotes.v055.feature3": "Optimized asynchronous IndexedDB operations.",
        "releaseNotes.v054.title": "Session Persistence",
        "releaseNotes.v054.feature1": "Saves active services, layout, scroll sync, and URLs on close.",
        "releaseNotes.v054.feature2": "WebView URL Bar: Dedicated URL bar with Reload, Copy, and Open in Browser buttons.",
        "releaseNotes.v054.feature3": "3x1 Vertical Layout: New layout option for vertically stacked services.",
        "releaseNotes.v053.title": "Enhanced Copy",
        "releaseNotes.v053.feature1": "Extracts full conversation with role distinction (User/AI).",
        "releaseNotes.v053.feature2": "Copy Last Response: Button to copy only the last AI response.",
        "releaseNotes.v053.feature3": "Per-Service Header: Dedicated header for each service panel.",
        "releaseNotes.v052.title": "Cross Check Enhancements",
        "releaseNotes.v052.feature1": "Editable predefined prompts and custom prompt management.",
        "releaseNotes.v052.feature2": "Robust Input State: Fixed issues with input fields becoming disabled.",
        "releaseNotes.v051.title": "Anonymous Cross Check",
        "releaseNotes.v051.feature1": "Replace service names with aliases.",
        "releaseNotes.v051.feature2": "Modern UI: Scroll sync toggle, layout icons, and refined styling.",
        "releaseNotes.v050.title": "File Upload Support",
        "releaseNotes.v050.feature1": "Multi-service broadcasting for files and images.",
        "releaseNotes.v050.feature2": "Drag & Drop: Direct file attachment support."
    },

    ko: {
        // Navigation
        "nav.features": "기능",
        "nav.useCases": "활용 사례",
        "nav.howItWorks": "작동 방식",
        "nav.downloads": "다운로드",
        "nav.releaseNotes": "릴리스 노트",
        "nav.getStarted": "시작하기",

        // Hero Section
        "hero.badge": "신규: Genspark 통합 추가",
        "hero.title1": "하나의 질문,",
        "hero.title2": "여섯 개의 AI가 동시에.",
        "hero.tagline": "탭 전환은 이제 그만. ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark에 프롬프트를 한 번에 전송하세요. 비교하고, 교차 검증하고, 더 빠르게 반복하세요.",
        "hero.downloadBtn": "데스크톱용 다운로드",
        "hero.githubBtn": "GitHub에서 보기",

        // Features Section
        "features.title": "파워 유저를 위한 강력한 기능",
        "features.tagline": "세계 최고의 AI 모델을 조율하는 데 필요한 모든 것.",
        "features.multiPane.title": "유연한 멀티 패널 UI",
        "features.multiPane.desc": "최대 4개의 서비스와 동시에 상호작용하세요. 2x2, 1x3, 1x4 또는 워크플로우에 맞는 특수 세로 레이아웃 중 선택하세요.",
        "features.simultaneous.title": "동시 프롬프팅",
        "features.simultaneous.desc": "한 번 입력하고, 모든 곳에 전송하세요. 중앙 입력창을 통해 모든 활성 서비스에 즉시 메시지를 브로드캐스트할 수 있습니다.",
        "features.crossCheck.title": "AI 교차 검증",
        "features.crossCheck.desc": "AI들이 서로를 검토하게 하세요. 클릭 한 번으로 각 서비스가 다른 서비스의 응답을 분석하고 비교합니다.",
        "features.session.title": "세션 유지",
        "features.session.desc": "환경이 자동으로 저장됩니다. 레이아웃, 활성 서비스, 특정 URL을 정확히 그 상태로 복원하세요.",
        "features.privacy.title": "프라이버시 우선",
        "features.privacy.desc": "공식 서비스에 직접 로그인. 중개자 없음, 자격 증명 저장 없음. 세션은 격리된 샌드박스 환경에서 실행됩니다.",
        "features.fileUpload.title": "범용 파일 지원",
        "features.fileUpload.desc": "이미지와 텍스트를 드래그 앤 드롭하거나 붙여넣기하세요. 검증된 2단계 워크플로우로 여러 AI에 동시에 업로드합니다.",

        // Comparison Section
        "comparison.title": "원활한 비교를 위해 설계됨",
        "comparison.scrollSync": "스크롤 동기화",
        "comparison.scrollSyncDesc": "한 패널을 스크롤하면 다른 패널도 따라갑니다.",
        "comparison.anonymous": "익명 모드",
        "comparison.anonymousDesc": "비교 중 AI 이름을 숨겨 편견을 줄입니다.",
        "comparison.markdown": "마크다운 복사",
        "comparison.markdownDesc": "클릭 한 번으로 전체 스레드 또는 마지막 응답만 복사합니다.",

        // Download Section
        "download.title": "오늘 브로드캐스팅을 시작하세요",
        "download.tagline": "원하는 플랫폼용으로 다운로드하세요. 오픈소스 및 비상업적.",
        "download.windows": "Windows",
        "download.windowsDesc": "v0.5.6 | 포터블 EXE & 설치 프로그램",
        "download.downloadExe": ".exe 다운로드",
        "download.macos": "macOS",
        "download.comingSoon": "출시 예정",
        "download.chrome": "Chrome 확장 프로그램",
        "download.chromeDesc": "웹 스토어 출시 예정",

        // Footer
        "footer.tagline": "AI 파워 유저를 위한 궁극의 브라우저.",
        "footer.product": "제품",
        "footer.resources": "리소스",
        "footer.documentation": "문서",
        "footer.reportIssue": "이슈 신고",
        "footer.community": "커뮤니티",
        "footer.updates": "업데이트",
        "footer.copyright": "2025 Joseph Nam. Polyform 비상업적 라이선스 1.0.0.",

        // Use Cases Page
        "useCases.hero.title1": "어떤",
        "useCases.hero.title2": "워크플로우",
        "useCases.hero.title3": "를 혁신할까요?",
        "useCases.hero.tagline": "실제 사용자들의 검증된 시나리오를 살펴보고 AI 기반 생산성을 가속화하세요.",
        "useCases.roles.research": "연구 및 분석",
        "useCases.roles.creator": "콘텐츠 제작",
        "useCases.roles.business": "비즈니스 전략",
        "useCases.roles.educator": "교육",
        "useCases.roles.developer": "개발",

        // Researcher Section
        "useCases.researcher.title": "연구자 및 분석가",
        "useCases.researcher.tagline": "다각적 관점으로 복잡한 주제를 심층 분석",
        "useCases.researcher.scenarioA.title": "다각도 문서 분석",
        "useCases.researcher.scenarioA.desc": "100+ 페이지 보고서를 여러 관점에서 동시에 분석",
        "useCases.researcher.scenarioA.metric1": "시간 절약",
        "useCases.researcher.scenarioA.metric2": "사각지대 감소",
        "useCases.researcher.scenarioB.title": "가속화된 학습 루프",
        "useCases.researcher.scenarioB.desc": "질문을 연결하여 빠르게 지식 구조 구축",
        "useCases.researcher.scenarioB.metric1": "학습 속도",

        // Creator Section
        "useCases.creator.title": "콘텐츠 크리에이터 및 작가",
        "useCases.creator.tagline": "프롬프트 엔지니어링을 마스터하고 콘텐츠 품질 최적화",
        "useCases.creator.scenarioC.title": "최적의 프롬프트 엔지니어링",
        "useCases.creator.scenarioC.desc": "각 AI의 강점을 발견하고 하이브리드 프롬프트 생성",
        "useCases.creator.scenarioC.metric1": "품질 향상",
        "useCases.creator.scenarioC.metric2": "빠른 반복",
        "useCases.creator.scenarioD.title": "대규모 A/B 테스트",
        "useCases.creator.scenarioD.desc": "마케팅 카피 변형을 즉시 비교",
        "useCases.creator.scenarioD.metric1": "프로젝트당 절약",

        // Business Section
        "useCases.business.title": "비즈니스 의사결정자",
        "useCases.business.tagline": "멀티 AI 관점으로 사각지대를 줄이고 결정을 검증",
        "useCases.business.scenarioE.title": "리스크 분석 및 악마의 변호인",
        "useCases.business.scenarioE.desc": "주요 결정 전 반대 관점 수집",
        "useCases.business.scenarioE.metric1": "더 많은 반론",
        "useCases.business.scenarioF.title": "경쟁 정보",
        "useCases.business.scenarioF.desc": "주 단위가 아닌 시간 단위로 경쟁사 전략 분석",
        "useCases.business.scenarioF.metric1": "빠른 인사이트",

        // Educator Section
        "useCases.educator.title": "교육자 및 트레이너",
        "useCases.educator.tagline": "다양한 청중을 위한 다단계 설명 생성",
        "useCases.educator.scenarioG.title": "다단계 콘텐츠 생성",
        "useCases.educator.scenarioG.desc": "초급부터 전문가 수준까지 설명 생성",
        "useCases.educator.scenarioG.metric1": "이해도+",
        "useCases.educator.scenarioG.metric2": "난이도 레벨",

        // Developer Section
        "useCases.developer.title": "개발자 및 엔지니어",
        "useCases.developer.tagline": "멀티 AI 분석으로 코드 리뷰 민주화",
        "useCases.developer.scenarioH.title": "멀티 AI 코드 리뷰",
        "useCases.developer.scenarioH.desc": "집단 AI 지능으로 더 많은 버그 발견",
        "useCases.developer.scenarioH.metric1": "더 많은 버그 발견",
        "useCases.developer.scenarioH.metric2": "평균 이슈 vs 6",

        // CTA
        "cta.title": "워크플로우를 혁신할 준비가 되셨나요?",
        "cta.tagline": "Sync Multi Chat을 다운로드하고 멀티 AI 오케스트레이션의 힘을 경험하세요.",
        "cta.downloadBtn": "무료 다운로드",

        // Release Notes
        "releaseNotes.title": "릴리스 히스토리",
        "releaseNotes.lastUpdated": "최종 업데이트: 2025년 12월 18일",
        "releaseNotes.current": "현재",
        "releaseNotes.newFeatures": "새로운 기능",
        "releaseNotes.v056.feature1": "Genspark 통합: 검색 기반 AI 채팅 완벽 지원.",
        "releaseNotes.v056.feature2": "익명 매핑: Genspark을 별칭 \"(F)\"로 매핑.",
        "releaseNotes.v055.title": "대화 기록",
        "releaseNotes.v055.feature1": "쉬운 기록 접근을 위한 새로운 접이식 사이드바.",
        "releaseNotes.v055.feature2": "세션, 레이아웃, URL 자동 저장 기능.",
        "releaseNotes.v055.feature3": "최적화된 비동기 IndexedDB 작업.",
        "releaseNotes.v054.title": "세션 유지",
        "releaseNotes.v054.feature1": "종료 시 활성 서비스, 레이아웃, 스크롤 동기화, URL 저장.",
        "releaseNotes.v054.feature2": "WebView URL 바: 새로고침, 복사, 브라우저에서 열기 버튼이 있는 전용 URL 바.",
        "releaseNotes.v054.feature3": "3x1 세로 레이아웃: 세로로 쌓인 서비스를 위한 새 레이아웃 옵션.",
        "releaseNotes.v053.title": "향상된 복사",
        "releaseNotes.v053.feature1": "역할 구분(사용자/AI)이 있는 전체 대화 추출.",
        "releaseNotes.v053.feature2": "마지막 응답 복사: 마지막 AI 응답만 복사하는 버튼.",
        "releaseNotes.v053.feature3": "서비스별 헤더: 각 서비스 패널 전용 헤더.",
        "releaseNotes.v052.title": "교차 검증 개선",
        "releaseNotes.v052.feature1": "편집 가능한 사전 정의 프롬프트 및 사용자 정의 프롬프트 관리.",
        "releaseNotes.v052.feature2": "안정적인 입력 상태: 입력 필드 비활성화 문제 수정.",
        "releaseNotes.v051.title": "익명 교차 검증",
        "releaseNotes.v051.feature1": "서비스 이름을 별칭으로 대체.",
        "releaseNotes.v051.feature2": "모던 UI: 스크롤 동기화 토글, 레이아웃 아이콘 및 정제된 스타일링.",
        "releaseNotes.v050.title": "파일 업로드 지원",
        "releaseNotes.v050.feature1": "파일 및 이미지 멀티 서비스 브로드캐스팅.",
        "releaseNotes.v050.feature2": "드래그 앤 드롭: 직접 파일 첨부 지원."
    },

    ja: {
        // Navigation
        "nav.features": "機能",
        "nav.useCases": "活用事例",
        "nav.howItWorks": "仕組み",
        "nav.downloads": "ダウンロード",
        "nav.releaseNotes": "リリースノート",
        "nav.getStarted": "始める",

        // Hero Section
        "hero.badge": "新機能: Genspark統合追加",
        "hero.title1": "1つのプロンプト、",
        "hero.title2": "6つのAIが同時に。",
        "hero.tagline": "タブの切り替えはもう不要。ChatGPT、Claude、Gemini、Grok、Perplexity、Genspark にプロンプトを一度に送信。比較、クロスチェック、そして高速な反復を。",
        "hero.downloadBtn": "デスクトップ版をダウンロード",
        "hero.githubBtn": "GitHubで見る",

        // Features Section
        "features.title": "パワーユーザー向けの強力な機能",
        "features.tagline": "世界最高のAIモデルをオーケストレーションするために必要なすべて。",
        "features.multiPane.title": "柔軟なマルチペインUI",
        "features.multiPane.desc": "最大4つのサービスと同時にやり取り。2x2、1x3、1x4、またはワークフローに合わせた特殊な縦レイアウトから選択。",
        "features.simultaneous.title": "同時プロンプティング",
        "features.simultaneous.desc": "一度入力して、すべてに送信。中央入力バーで、すべてのアクティブなサービスに瞬時にメッセージをブロードキャスト。",
        "features.crossCheck.title": "AIクロスチェック",
        "features.crossCheck.desc": "AIに互いをレビューさせましょう。ワンクリックで各サービスが他のサービスの回答を分析・比較。",
        "features.session.title": "セッション永続化",
        "features.session.desc": "環境は自動的に保存されます。レイアウト、アクティブなサービス、特定のURLを正確に復元。",
        "features.privacy.title": "プライバシー最優先",
        "features.privacy.desc": "公式サービスに直接ログイン。仲介者なし、認証情報の保存なし。セッションは隔離されたサンドボックス環境で実行。",
        "features.fileUpload.title": "ユニバーサルファイルサポート",
        "features.fileUpload.desc": "画像やテキストをドラッグ＆ドロップまたはペースト。検証済みの2ステップワークフローで複数のAIに同時アップロード。",

        // Comparison Section
        "comparison.title": "シームレスな比較のために設計",
        "comparison.scrollSync": "スクロール同期",
        "comparison.scrollSyncDesc": "1つのパネルをスクロールすると、他のパネルも追従。",
        "comparison.anonymous": "匿名モード",
        "comparison.anonymousDesc": "比較中にAI名を非表示にしてバイアスを軽減。",
        "comparison.markdown": "マークダウンコピー",
        "comparison.markdownDesc": "ワンクリックでスレッド全体または最後の回答のみをコピー。",

        // Download Section
        "download.title": "今日からブロードキャストを開始",
        "download.tagline": "お好みのプラットフォーム用にダウンロード。オープンソース・非商用。",
        "download.windows": "Windows",
        "download.windowsDesc": "v0.5.6 | ポータブルEXE & インストーラー",
        "download.downloadExe": ".exeをダウンロード",
        "download.macos": "macOS",
        "download.comingSoon": "近日公開",
        "download.chrome": "Chrome拡張機能",
        "download.chromeDesc": "ウェブストアに近日公開",

        // Footer
        "footer.tagline": "AIパワーユーザーのための究極のブラウザ。",
        "footer.product": "製品",
        "footer.resources": "リソース",
        "footer.documentation": "ドキュメント",
        "footer.reportIssue": "問題を報告",
        "footer.community": "コミュニティ",
        "footer.updates": "更新情報",
        "footer.copyright": "2025 Joseph Nam. Polyform非商用ライセンス 1.0.0.",

        // Use Cases Page
        "useCases.hero.title1": "どの",
        "useCases.hero.title2": "ワークフロー",
        "useCases.hero.title3": "を変革しますか？",
        "useCases.hero.tagline": "実際のユーザーから得た実証済みシナリオを探索し、AI駆動の生産性を加速。",
        "useCases.roles.research": "調査・分析",
        "useCases.roles.creator": "コンテンツ制作",
        "useCases.roles.business": "ビジネス戦略",
        "useCases.roles.educator": "教育",
        "useCases.roles.developer": "開発",

        // Researcher Section
        "useCases.researcher.title": "研究者・アナリスト",
        "useCases.researcher.tagline": "多角的な視点で複雑なトピックを深く分析",
        "useCases.researcher.scenarioA.title": "多角的ドキュメント分析",
        "useCases.researcher.scenarioA.desc": "100ページ以上のレポートを複数の視点から同時に分析",
        "useCases.researcher.scenarioA.metric1": "時間節約",
        "useCases.researcher.scenarioA.metric2": "死角の削減",
        "useCases.researcher.scenarioB.title": "加速学習ループ",
        "useCases.researcher.scenarioB.desc": "質問を連鎖させて知識構造を素早く構築",
        "useCases.researcher.scenarioB.metric1": "学習速度",

        // Creator Section
        "useCases.creator.title": "コンテンツクリエイター・ライター",
        "useCases.creator.tagline": "プロンプトエンジニアリングを極め、コンテンツ品質を最適化",
        "useCases.creator.scenarioC.title": "最適なプロンプトエンジニアリング",
        "useCases.creator.scenarioC.desc": "各AIの強みを発見し、ハイブリッドプロンプトを作成",
        "useCases.creator.scenarioC.metric1": "品質向上",
        "useCases.creator.scenarioC.metric2": "高速反復",
        "useCases.creator.scenarioD.title": "大規模A/Bテスト",
        "useCases.creator.scenarioD.desc": "マーケティングコピーのバリエーションを即座に比較",
        "useCases.creator.scenarioD.metric1": "プロジェクトあたりの節約",

        // Business Section
        "useCases.business.title": "ビジネス意思決定者",
        "useCases.business.tagline": "マルチAIの視点で死角を減らし、決定を検証",
        "useCases.business.scenarioE.title": "リスク分析・悪魔の代弁者",
        "useCases.business.scenarioE.desc": "重要な決定の前に反対意見を収集",
        "useCases.business.scenarioE.metric1": "より多くの反論",
        "useCases.business.scenarioF.title": "競合情報",
        "useCases.business.scenarioF.desc": "週単位ではなく時間単位で競合戦略を分析",
        "useCases.business.scenarioF.metric1": "高速インサイト",

        // Educator Section
        "useCases.educator.title": "教育者・トレーナー",
        "useCases.educator.tagline": "多様なオーディエンス向けに多段階の説明を生成",
        "useCases.educator.scenarioG.title": "多段階コンテンツ生成",
        "useCases.educator.scenarioG.desc": "初級から専門家レベルまでの説明を作成",
        "useCases.educator.scenarioG.metric1": "理解度+",
        "useCases.educator.scenarioG.metric2": "難易度レベル",

        // Developer Section
        "useCases.developer.title": "開発者・エンジニア",
        "useCases.developer.tagline": "マルチAI分析でコードレビューを民主化",
        "useCases.developer.scenarioH.title": "マルチAIコードレビュー",
        "useCases.developer.scenarioH.desc": "集合知AIでより多くのバグを発見",
        "useCases.developer.scenarioH.metric1": "発見バグ増加",
        "useCases.developer.scenarioH.metric2": "平均課題 vs 6",

        // CTA
        "cta.title": "ワークフローを変革する準備はできましたか？",
        "cta.tagline": "Sync Multi Chatをダウンロードして、マルチAIオーケストレーションの力を体験。",
        "cta.downloadBtn": "無料ダウンロード",

        // Release Notes
        "releaseNotes.title": "リリース履歴",
        "releaseNotes.lastUpdated": "最終更新: 2025年12月18日",
        "releaseNotes.current": "現在",
        "releaseNotes.newFeatures": "新機能",
        "releaseNotes.v056.feature1": "Genspark統合: 検索駆動AIチャットの完全サポート。",
        "releaseNotes.v056.feature2": "匿名マッピング: Genspark をエイリアス「(F)」にマッピング。",
        "releaseNotes.v055.title": "会話履歴",
        "releaseNotes.v055.feature1": "簡単な履歴アクセスのための新しい折りたたみ式サイドバー。",
        "releaseNotes.v055.feature2": "セッション、レイアウト、URLの自動保存機能。",
        "releaseNotes.v055.feature3": "最適化された非同期IndexedDB操作。",
        "releaseNotes.v054.title": "セッション永続化",
        "releaseNotes.v054.feature1": "終了時にアクティブサービス、レイアウト、スクロール同期、URLを保存。",
        "releaseNotes.v054.feature2": "WebView URLバー: リロード、コピー、ブラウザで開くボタン付きの専用URLバー。",
        "releaseNotes.v054.feature3": "3x1縦レイアウト: 縦に積み重ねたサービス用の新レイアウトオプション。",
        "releaseNotes.v053.title": "コピー機能強化",
        "releaseNotes.v053.feature1": "役割区別（ユーザー/AI）付きの完全な会話抽出。",
        "releaseNotes.v053.feature2": "最後の回答をコピー: 最後のAI回答のみをコピーするボタン。",
        "releaseNotes.v053.feature3": "サービス別ヘッダー: 各サービスパネル専用ヘッダー。",
        "releaseNotes.v052.title": "クロスチェック強化",
        "releaseNotes.v052.feature1": "編集可能な定義済みプロンプトとカスタムプロンプト管理。",
        "releaseNotes.v052.feature2": "堅牢な入力状態: 入力フィールドが無効になる問題を修正。",
        "releaseNotes.v051.title": "匿名クロスチェック",
        "releaseNotes.v051.feature1": "サービス名をエイリアスに置換。",
        "releaseNotes.v051.feature2": "モダンUI: スクロール同期トグル、レイアウトアイコン、洗練されたスタイリング。",
        "releaseNotes.v050.title": "ファイルアップロードサポート",
        "releaseNotes.v050.feature1": "ファイルと画像のマルチサービスブロードキャスティング。",
        "releaseNotes.v050.feature2": "ドラッグ＆ドロップ: 直接ファイル添付サポート。"
    }
};

// Language names for display
const languageNames = {
    en: "🇺🇸 English",
    ko: "🇰🇷 한국어",
    ja: "🇯🇵 日本語"
};

// Current language
let currentLanguage = localStorage.getItem('smc-language') || 'en';

/**
 * Get translation for a key
 */
function t(key) {
    return translations[currentLanguage]?.[key] || translations['en']?.[key] || key;
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);

        // Handle elements with HTML content
        if (el.hasAttribute('data-i18n-html')) {
            el.innerHTML = translation;
        } else {
            el.textContent = translation;
        }
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Update active language in dropdown
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === currentLanguage);
    });

    // Update language button text
    const langBtn = document.querySelector('.lang-btn span');
    if (langBtn) {
        langBtn.textContent = languageNames[currentLanguage];
    }

    // Update html lang attribute
    document.documentElement.lang = currentLanguage;
}

/**
 * Set language and apply translations
 */
function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('smc-language', lang);
        applyTranslations();
    }
}

/**
 * Initialize language selector
 */
function initLanguageSelector() {
    const langBtn = document.querySelector('.lang-btn');
    const langDropdown = document.querySelector('.lang-dropdown');

    if (langBtn && langDropdown) {
        // Toggle dropdown
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('active');
        });

        // Language option click
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', () => {
                setLanguage(opt.dataset.lang);
                langDropdown.classList.remove('active');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            langDropdown.classList.remove('active');
        });
    }
}

/**
 * Initialize hamburger menu
 */
function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger-menu');
    const mobileNav = document.querySelector('.mobile-nav');

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileNav.classList.toggle('active');
        });

        // Close mobile nav when clicking a link
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                mobileNav.classList.remove('active');
            });
        });
    }
}

/**
 * Initialize i18n system
 */
function initI18n() {
    initLanguageSelector();
    initHamburgerMenu();
    applyTranslations();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    initI18n();
}
