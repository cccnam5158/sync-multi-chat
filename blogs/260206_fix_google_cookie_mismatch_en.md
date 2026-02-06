# Fixing Google CookieMismatch Error in Electron 39 (Chromium 134)

**Date**: February 6, 2026  
**Version**: v0.6.1  
**Category**: Bug Fix, Electron, Google Authentication

---

## The Problem

After upgrading to Electron 39 (Chromium 134), users of Sync Multi Chat encountered a critical `accounts.google.com/CookieMismatch` error when trying to log in to Gemini or Genspark via Google authentication. The Google login flow — which redirects between `accounts.google.com` and `gemini.google.com` — was completely broken.

## Root Cause Analysis

### 1. Chromium 134's Third-Party Cookie Phase-Out

Chromium 134 introduced the **third-party cookie deprecation** policy. Google's authentication flow requires cookies to be shared across domains (`accounts.google.com` ↔ `gemini.google.com`). Under Chromium 134's new restrictions, these cross-domain cookies were being **silently blocked**, resulting in authentication failures.

Additionally, **Cookie Partitioning (CHIPS)** was isolating cookies per top-level site, which further disrupted the Google SSO flow.

### 2. Response Header Manipulation Breaking Set-Cookie

Our app's `onHeadersReceived` handler was removing `X-Frame-Options` and `Content-Security-Policy` headers from **all** responses — including those from `accounts.google.com`. This broad manipulation was inadvertently interfering with Google's `Set-Cookie` headers, especially for `__Host-` prefixed cookies that have strict security requirements:
- Must be set with the `Secure` flag
- Must NOT have a `Domain` attribute
- Must have `Path` set to `/`

### 3. User-Agent Version Mismatch

The app declared `Chrome/130` in the User-Agent string, but was actually running Chromium 134. Google detected this discrepancy between the declared version and the browser's actual capabilities, flagging the session as potentially automated.

## The Fix

### Disabling Third-Party Cookie Restrictions

```javascript
app.commandLine.appendSwitch(
    'disable-features',
    'ThirdPartyCookieDeprecationTrial,TrackingProtection3pcd,PartitionedCookies,BoundSessionCredentials'
);
```

### Preserving Google Auth Domain Headers

```javascript
view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || '';
    if (url.includes('accounts.google.com') ||
        url.includes('myaccount.google.com') ||
        url.includes('accounts.youtube.com')) {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
        return;
    }
    // ... existing header manipulation for other domains
});
```

### Dynamic User-Agent Versioning

```javascript
const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
```

## Key Takeaways

1. **Always test auth flows after Chromium upgrades** — Cookie policies change frequently and can silently break cross-domain authentication.
2. **Be selective with header manipulation** — Don't apply broad response header modifications to authentication domains.
3. **Keep User-Agent consistent with the actual engine** — Version mismatches trigger bot detection on major platforms.
4. **Monitor `__Host-` and `__Secure-` cookie handling** — These cookie prefixes have strict requirements that are easily broken by middleware.

## Affected Services

| Service | Impact | Status |
|---------|--------|--------|
| Gemini | Google login blocked | **Fixed** |
| Genspark | Google login blocked | **Fixed** |
| Grok | Google SSO affected | **Fixed** |
| ChatGPT | Not affected | — |
| Claude | Not affected | — |
| Perplexity | Not affected | — |

---

*This fix is included in Sync Multi Chat v0.6.1. Update via the auto-updater or download from the [releases page](https://github.com/cccnam5158/sync-multi-chat/releases).*
