# Electron 39 (Chromium 134) でのGoogle CookieMismatchエラーの解決

**日付**: 2026年2月6日  
**バージョン**: v0.6.1  
**カテゴリ**: バグ修正、Electron、Google認証

---

## 問題の状況

Electron 39 (Chromium 134)へのアップグレード後、Sync Multi Chatのユーザーが、GeminiまたはGensparkでGoogle認証によるログインを試みた際に、`accounts.google.com/CookieMismatch`エラーが発生しました。`accounts.google.com`と`gemini.google.com`間のリダイレクトを含むGoogleログインフローが完全に機能しなくなりました。

## 原因分析

### 1. Chromium 134のサードパーティクッキー段階的廃止

Chromium 134は**サードパーティクッキー廃止（Third-Party Cookie Deprecation）**ポリシーを導入しました。Googleの認証フローでは、ドメイン間（`accounts.google.com` ↔ `gemini.google.com`）でのクッキー共有が必須です。Chromium 134の新しい制限により、これらのクロスドメインクッキーが**サイレントにブロック**され、認証失敗が発生しました。

また、**クッキーパーティショニング（CHIPS）**がトップレベルサイトごとにクッキーを分離し、Google SSOフローをさらに妨害しました。

### 2. レスポンスヘッダー操作によるSet-Cookieの破損

アプリの`onHeadersReceived`ハンドラが、`accounts.google.com`を含む**すべての**レスポンスから`X-Frame-Options`および`Content-Security-Policy`ヘッダーを削除していました。この広範なヘッダー操作が、Googleの`Set-Cookie`ヘッダーに意図せず影響を与え、特に厳格なセキュリティ要件を持つ`__Host-`プレフィックスクッキーに問題を引き起こしました：
- `Secure`フラグが必須
- `Domain`属性が**あってはならない**
- `Path`が必ず`/`であること

### 3. User-Agentバージョンの不一致

アプリがUser-Agent文字列で`Chrome/130`を宣言していましたが、実際にはChromium 134を実行していました。Googleは宣言されたバージョンとブラウザの実際の機能の不一致を検出し、セッションを自動化されたものとしてフラグ付けしました。

## 修正方法

### サードパーティクッキー制限の無効化

```javascript
app.commandLine.appendSwitch(
    'disable-features',
    'ThirdPartyCookieDeprecationTrial,TrackingProtection3pcd,PartitionedCookies,BoundSessionCredentials'
);
```

### Google認証ドメインヘッダーの保持

```javascript
view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || '';
    if (url.includes('accounts.google.com') ||
        url.includes('myaccount.google.com') ||
        url.includes('accounts.youtube.com')) {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
        return;
    }
    // ... 他のドメインに対する既存のヘッダー操作ロジック
});
```

### 動的User-Agentバージョン管理

```javascript
const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
```

## 重要な教訓

1. **Chromiumアップグレード後は必ず認証フローをテスト** — クッキーポリシーは頻繁に変更され、クロスドメイン認証をサイレントに破壊する可能性があります。
2. **ヘッダー操作は選択的に適用** — 認証ドメインに対して広範なレスポンスヘッダー変更を適用しないでください。
3. **User-Agentを実際のエンジンと一致させる** — バージョンの不一致は主要プラットフォームでボット検出をトリガーします。
4. **`__Host-`および`__Secure-`クッキーの処理を監視** — これらのクッキープレフィックスはミドルウェアによって容易に壊れる厳格な要件を持っています。

## 影響を受けたサービス

| サービス | 影響 | ステータス |
|----------|------|-----------|
| Gemini | Googleログインがブロック | **修正済み** |
| Genspark | Googleログインがブロック | **修正済み** |
| Grok | Google SSOに影響 | **修正済み** |
| ChatGPT | 影響なし | — |
| Claude | 影響なし | — |
| Perplexity | 影響なし | — |

---

*この修正はSync Multi Chat v0.6.1に含まれています。自動アップデーターで更新するか、[リリースページ](https://github.com/cccnam5158/sync-multi-chat/releases)からダウンロードしてください。*
