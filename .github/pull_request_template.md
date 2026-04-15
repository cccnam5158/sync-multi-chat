## Summary

<!-- One to three bullet points describing what this PR does and why. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Refactor / cleanup (no behavior change)
- [ ] Documentation / tooling only
- [ ] UI / style change (requires the Design System checklist below)

## Design System Checklist (UI / style PRs)

> Skip this section if the PR does not touch `src/renderer/**/*.css`, renderer HTML, or visual renderer JS.

- [ ] I read `DESIGN.md` and this change reuses existing tokens / patterns
- [ ] If I needed new tokens, I added them to `src/renderer/styles/01-tokens.css` AND updated `DESIGN.md` in this same PR
- [ ] New CSS uses `var(--*)` tokens — no hardcoded hex / rgb / hsl literals in `src/renderer/styles/components/**/*.css`
- [ ] New partials are registered via `@import` in `src/renderer/styles.css` in the correct ordering bucket (fonts → tokens → base → scrollbars → components → features → modals)
- [ ] `npm run lint:css` passes locally (no errors; warnings from `features/` / `modals/` legacy code are acknowledged)
- [ ] I started Electron locally (`npm start`) and visually verified the changed area plus adjacent views for regressions (see §1-4 of PLAN for the regression sweep checklist)

## Test plan

<!-- Bulleted list of what you did to verify this change. For UI changes, mention which views you opened. -->

- [ ]
- [ ]

## Related issues / PRs

<!-- Paste issue/PR numbers or URLs. Use "Closes #123" to auto-link. -->

---
🗿 MoAI
