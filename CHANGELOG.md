# Changelog

## 0.2.0

- Preload the selected model silently after page load and browser idle time by default.
- Add `preload: "on-demand"` for sites that prefer first-use preparation.
- Make `prepare()` single-flight and idempotent and let `start()` ensure preparation automatically.
- Add `isPrepared()` for interaction logic that needs runtime readiness.
- Keep one cached model by default with `cachePolicy: "single-model"`; opt out with `"keep-all"`.
- Remove stale browser-whisper OPFS orphan files after a 24-hour safety grace period.
- Abort in-flight preparation when an instance is disposed.
