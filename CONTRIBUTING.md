# Contributing

Thanks for helping make X reply sections less noisy.

Good contributions include:

- New spam patterns with real examples.
- Safer scoring rules that reduce false positives.
- Browser compatibility fixes.
- Accessibility and localization improvements.
- Documentation that helps people find, install, and share the extension.

Before opening a PR:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate-extension.ps1
```

When adding a rule, prefer a specific phrase or regex over a broad keyword. Broad rules can hide normal replies.

Please do not submit fake stars, spam promotion, or misleading claims. The goal is honest discoverability: clear docs, useful examples, and a tool that actually helps people clean up X reply threads.
