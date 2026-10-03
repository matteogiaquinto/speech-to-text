# AGENTS.md

## Purpose

This repository owns the reusable browser speech-to-text package `@matteogiaquinto/speech-to-text`.

The package is intentionally small. It wraps `browser-whisper` and exposes `createSpeechToText()` so product repositories can add local Whisper dictation without reimplementing audio capture or inference.

When working on this repository, preserve that scope. Do not add product-specific framework UI components to the published package.

## Consumer integration contract

When an agent is asked to integrate this speech-to-text system into another application:

1. Follow `INTEGRATION.md` as the general integration source of truth.
2. Follow `docs/VOICE-UI.md` as the canonical microphone visual/interaction specification.
3. Use the public browser demo in `examples/browser` as the visual reference.
4. Install and use `@matteogiaquinto/speech-to-text`. Do not fork, copy, or directly reimplement `browser-whisper`.
5. Reuse the target application's existing input, textarea, form, icon, button, tooltip, notification, and design-system primitives.
6. At rest, use a compact microphone control, approximately 28 px by default.
7. While recording, morph the control into a capsule that expands left and shows elapsed time, waveform feedback, and a stop square.
8. Use the canonical interactions:
   - short tap starts and latches recording;
   - second tap stops and transcribes;
   - hold for about 300 ms enables push-to-talk and release stops;
   - while the starting pointer is still held, slide left about 64 px to cancel and discard;
   - `Enter` / `Space` start or stop;
   - `Escape` cancels.
9. For a normal single-line input, keep the compact microphone at the far right inside the field wrapper and reserve enough room that the expanded capsule cannot cover editable text.
10. For an AI/chat/command prompt, use an auto-growing textarea with a bottom toolbar. Place the voice pill on the toolbar's right side, immediately before an existing send button when applicable.
11. For an ordinary multiline textarea, place the voice pill at the right edge, normally bottom-right.
12. Do not invent model, source, attachment, effort, or send controls just to imitate an AI product. Reuse only capabilities that really exist in the host application.
13. Reuse the host application's colors, typography, icons, tooltips, and focus treatment. Do not add an icon library only for this feature.
14. Keep the button accessible with a label equivalent to `Start dictation` / `Stop dictation` and synchronize `aria-pressed`.
15. Respect `prefers-reduced-motion`; remove nonessential morphing/sliding while preserving clear state changes.
16. Create one long-lived speech-to-text instance for the relevant mounted feature and reuse it across successful recordings. Do not create a new Whisper instance for every click.
17. Use the package default background preload after the page `load` event and browser idle time. Set `preload: "on-demand"` only when the host product intentionally wants first-use preparation. `start()` handles either mode and waits for preparation before recording.
18. On a normal stop, call `stop()`, wait for transcription, then insert the returned string into the active field.
19. On slide-to-cancel or Escape, call `await speech.cancel()`. Discard any interrupted stop result and reuse the prepared instance.
20. Preserve existing field content. Prefer inserting transcription at the caret/selection when practical; otherwise append with exactly one separating space.
21. Use the application's state update mechanism for controlled fields. Do not mutate DOM `.value` directly in React/Vue/etc. unless the field is intentionally uncontrolled.
22. Keep manual typing usable while idle and after errors.
23. Map package status to UI:
    - `loading`: compact spinner; prevent duplicate activation.
    - `recording`: expanded capsule with timer + waveform + stop square.
    - `transcribing`: collapsed busy spinner; prevent duplicate activation.
    - `ready` / `idle`: compact microphone.
    - `error`: compact microphone plus the host product's normal non-blocking error UI.
24. If microphone levels are already available, use them for waveform feedback. Otherwise a subtle simulated waveform is acceptable; do not open a second microphone stream only for decoration.
25. Call `dispose()` when the owning component/feature is permanently unmounted. Do not dispose between ordinary successful recordings.
26. If several fields on the same screen need dictation, prefer sharing one speech-to-text instance and track which field is active. Only one recording/transcription should run at a time.
27. Production microphone access requires a secure context (HTTPS; localhost is acceptable for local development).
28. Do not blindly add COOP/COEP headers. They can affect third-party resources. Add the cross-origin-isolation headers documented in the README only when the target deployment needs the threaded WASM fallback, then verify the whole application still works.
29. Test at least: first model preparation, tap-to-latch, hold-to-talk, slide-to-cancel, keyboard controls, a second recording without re-downloading, repeated start/stop, French transcription, preservation of existing field text, microphone permission denial, reduced motion, and cleanup on unmount.

### Model cache behavior

`browser-whisper` stores downloaded model files in browser origin-private storage. Consequences for integration:

- The first use for a given browser profile + origin may download the model.
- Later visits to the same origin normally reuse the stored model instead of downloading it again.
- Reloading or closing the browser does not normally remove the cached model.
- The wrapper defaults to `cachePolicy: "single-model"`, removes other known model caches after preparation, and garbage-collects stale unreferenced OPFS files older than 24 hours.
- Use `cachePolicy: "keep-all"` only for products that intentionally need several models cached.
- `dispose()` releases runtime/worker resources; it does not clear the selected stored model.
- A different domain/subdomain, browser, browser profile, private session, cleared site data, or another machine can require another download.

Do not tell users that the model is downloaded "once per machine"; that is too broad. The useful mental model is "once per browser profile and site origin, until site data is removed."

## Preferred integration API

Use the public wrapper:

```ts
import { createSpeechToText } from "@matteogiaquinto/speech-to-text";

const speech = createSpeechToText({
  language: "fr",
  onStatus(status) {
    // Map package status to the host product's voice-control UI.
  },
});

await speech.start();
const text = await speech.stop();

speech.dispose();
```

Do not import `browser-whisper` directly from consumer applications unless a concrete missing capability in this wrapper makes that necessary.

## Publishing to npm

This package is published publicly as `@matteogiaquinto/speech-to-text` under the npm organization scope `@matteogiaquinto`.

The version `0.1.0` has already been published to npm. This repository now targets `0.2.0` for the preload/cache-policy release. npm package versions are immutable: **never attempt to publish an already-published version again**.

Before any future npm release:

1. Make sure the working tree is clean and all checks pass.
2. Check the currently published version:
   ```powershell
   npm view @matteogiaquinto/speech-to-text version
   ```
3. Bump the package version before publishing. For a normal bugfix:
   ```powershell
   npm version patch
   ```
4. Publish the new version:
   ```powershell
   npm publish --access public
   ```
5. Push the version commit/tag created by `npm version`:
   ```powershell
   git push --follow-tags
   ```

Use `npm version minor` or `npm version major` only when the release semantics justify it.

Publishing requires authentication for the npm organization and npm's required 2FA/security-key flow. Do not change the package scope to work around an authentication or permission error.

## Public repository quality

This is a public package and should remain presentable as a pinned GitHub project.

When changing public-facing material:

- Keep the README product-oriented and concise near the top.
- Keep the browser demo in `examples/browser` functional and visually representative of the recommended integration.
- Keep `docs/VOICE-UI.md`, `INTEGRATION.md`, and the demo aligned; do not change one interaction contract without updating the others.
- Do not add a UI framework dependency only for the demo.
- Preserve the CI workflow and keep all quality checks green.
- Keep the public demo deployable as a static Vite build.
- Prefer screenshots/preview assets that accurately represent the real integration behavior.
- Do not claim that audio is uploaded or processed remotely; model files may be downloaded, but transcription itself is local.
- Do not claim the model cache is global to the whole machine. Cache scope is browser profile + site origin.
