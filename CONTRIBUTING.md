# Contributing

Thanks for helping make X reply sections less noisy.

Good contributions include:

- New spam patterns with real examples.
- Safer scoring rules that reduce false positives.
- Browser compatibility fixes.
- Accessibility and localization improvements.

Before opening a PR:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate-extension.ps1
```

When adding a rule, prefer a specific phrase or regex over a broad keyword. Broad rules can hide normal replies.
