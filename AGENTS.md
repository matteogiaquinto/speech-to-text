# AGENTS.md

## Purpose

This repository owns the reusable browser speech-to-text package `@matteogiaquinto/speech-to-text`.

The package is intentionally small. It wraps `browser-whisper` and exposes `createSpeechToText()` so product repositories can add local Whisper dictation without reimplementing audio capture or inference.

When working on this repository, preserve that scope. Do not add product-specific UI components to the package.

## Consumer integration contract

When an agent is asked to integrate this speech-to-text system into another application, follow `INTEGRATION.md` as the source of truth.

The expected product behavior is:

1. Install and use `@matteogiaquinto/speech-to-text`. Do not fork, copy, or directly reimplement `browser-whisper`.
2. Reuse the target application's existing input, textarea, form, icon, button, tooltip, notification, and design-system components.
3. Add an icon-only microphone control at the far right inside the target text input's visual container. Keep it vertically centered for a single-line input. Preserve enough right padding on the field so typed text never sits under the button.
4. Do not redesign the surrounding form. The microphone is an input adornment, not a separate large action.
5. Use the target application's existing microphone icon if one exists. Do not add a new icon library only for this feature.
6. Give the button an accessible label and tooltip. Minimum labels are equivalent to "Start dictation" and "Stop dictation".
7. Create one long-lived speech-to-text instance for the relevant mounted feature and reuse it across recordings. Do not create a new Whisper instance for every click.
8. Do not download the model automatically on initial page load. Model preparation is substantial. Start preparation after explicit user intent, normally on the first microphone click, show a loading state, then start recording automatically when preparation finishes.
9. First microphone activation: prepare if needed, then call `start()`. While recording, the same control stops recording. On stop, call `stop()`, wait for transcription, then write the returned string into the target field.
10. Preserve existing field content. Prefer inserting the transcription at the current caret/selection when the target UI makes this practical. Otherwise append it with exactly one separating space. Never silently replace existing user text unless the product explicitly requires replacement.
11. Use the application's state update mechanism for controlled fields. Do not mutate DOM `.value` directly in React/Vue/etc. unless the field is intentionally uncontrolled.
12. Keep the field manually usable while the speech feature is idle or after an error.
13. Map package status to UI:
    - `loading`: disable repeated microphone activation and show a small loading indicator on/in place of the microphone.
    - `recording`: clearly show an active recording state.
    - `transcribing`: show a small busy indicator and prevent duplicate stop/start actions.
    - `ready` / `idle`: normal microphone state.
    - `error`: restore the normal input and show a concise non-blocking error using the product's existing notification pattern.
14. Call `dispose()` when the owning component/feature is permanently unmounted. Do not dispose between ordinary recordings.
15. If several fields on the same screen need dictation, prefer sharing one speech-to-text instance and track which field is active. Only one recording/transcription should run at a time.
16. Production microphone access requires a secure context (HTTPS; localhost is acceptable for local development).
17. Do not blindly add COOP/COEP headers. They can affect third-party resources. Add the cross-origin-isolation headers documented in the README only when the target deployment needs the threaded WASM fallback, then verify the whole application still works.
18. Test at least: first model preparation, a second recording without re-downloading, repeated start/stop, French transcription, preservation of existing field text, microphone permission denial, and cleanup on unmount.

### Model cache behavior

`browser-whisper` stores downloaded model files in browser origin-private storage. Consequences for integration:

- The first use for a given browser profile + origin may download the model.
- Later visits to the same origin normally reuse the stored model instead of downloading it again.
- Reloading or closing the browser does not normally remove the cached model.
- `dispose()` releases runtime/worker resources; it does not clear the stored model.
- A different domain/subdomain, browser, browser profile, private session, cleared site data, or another machine can require another download.

Do not tell users that the model is downloaded "once per machine"; that is too broad. The useful mental model is "once per browser profile and site origin, until site data is removed."

## Preferred integration API

Use the public wrapper:

```ts
import { createSpeechToText } from "@matteogiaquinto/speech-to-text";

const speech = createSpeechToText({
  language: "fr",
  onStatus(status) {
    // Map this to the target application's UI state.
  },
});

await speech.prepare();
await speech.start();
const text = await speech.stop();

speech.dispose();
```

Do not import `browser-whisper` directly from consumer applications unless a concrete missing capability in this wrapper makes that necessary.

## Publishing to npm

This package is published publicly as `@matteogiaquinto/speech-to-text` under the npm organization scope `@matteogiaquinto`.

The version `0.1.0` has already been published to npm. npm package versions are immutable: **never attempt to publish an already-published version again**.

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
- Keep the browser demo in `examples/browser` functional and visually representative of the recommended input integration.
- Do not add a UI framework dependency only for the demo.
- Preserve the CI workflow and keep all quality checks green.
- Keep the public demo deployable as a static Vite build.
- Prefer screenshots/preview assets that accurately represent the real integration behavior.
- Do not claim that audio is uploaded or processed remotely; model files may be downloaded, but transcription itself is local.
- Do not claim the model cache is global to the whole machine. Cache scope is browser profile + site origin.
