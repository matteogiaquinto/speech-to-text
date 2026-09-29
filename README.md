# @matteogiaquinto/speech-to-text

A deliberately small, browser-only TypeScript wrapper around [browser-whisper](https://github.com/tanpreetjolly/browser-whisper). It records a short microphone clip and returns a plain transcription string. Whisper runs locally in the browser: no cloud speech API, backend, or API key is used.

## Installation

Requires Node.js 22 or later for tooling, and a modern browser at runtime.

```powershell
pnpm add @matteogiaquinto/speech-to-text
```

## Usage

```ts
import { createSpeechToText } from "@matteogiaquinto/speech-to-text";

const speech = createSpeechToText({ language: "fr" });

await speech.prepare();
await speech.start();

// The user speaks French.
const text = await speech.stop();

console.log(text);
speech.dispose();
```

`language` defaults to `"fr"`; `model` defaults to `"whisper-base"`.

```ts
const speech = createSpeechToText({
  language: "fr",
  model: "whisper-base",
  onStatus(status) {
    console.log(status);
  },
});
```

The optional statuses are `idle`, `loading`, `ready`, `recording`, `transcribing`, and `error`.

## Integrating into a product

For CRM/forms/admin interfaces, follow [INTEGRATION.md](INTEGRATION.md). It defines the standard microphone-button placement, lifecycle, field-update behavior, loading/recording/transcribing states, multiple-field behavior, cache semantics, deployment constraints, and acceptance checklist.

Coding agents working from this repository should also follow [AGENTS.md](AGENTS.md).

The standard UI is an icon-only microphone control embedded at the far right of the target input. The package should be installed from npm and reused as a long-lived instance; consumer applications should not fork or reimplement the Whisper engine.

## Lifecycle

- `prepare()` downloads and loads the selected model without opening the microphone. The engine instance is retained for later recordings.
- `start()` asks for microphone permission only then and begins recording.
- `stop()` stops every microphone track, transcribes the recorded clip locally, and returns joined, trimmed segment text.
- `dispose()` stops microphone tracks and cancels an in-flight transcription. Call it when the instance will not be reused.

`start()` rejects while already recording. `stop()` rejects when no recording is active. Errors are exposed as `SpeechToTextError`, `MicrophoneError`, or `TranscriptionError`, with the underlying error available as `cause`.

## Browser requirements and privacy

This package inherits browser-whisper’s limitations: model downloads are substantial (`whisper-base` is approximately 136 MB), first use requires network access, and browser support/performance depends on WebGPU, WebCodecs, and WASM fallbacks. For threaded WASM, serve pages with cross-origin isolation headers when required:

```text
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Do not add those headers blindly to an existing product; they can affect third-party resources. Verify the complete application when enabling cross-origin isolation.

The included Vite example configures these headers for development and preview. Importing this package is SSR-safe; browser APIs and browser-whisper are accessed only when a lifecycle method runs. The package is intended for short 2–30 second commands, form input, and notes—not long meetings or diarization.

Audio and transcription remain in the user’s browser. Review browser-whisper’s own hosting, cache, and model-download behavior before making privacy guarantees for a production application.

### Model cache

Downloaded model files are stored in browser origin-private storage and normally reused on later visits to the same origin. The useful cache scope is **browser profile + site origin**, not the whole machine.

A different domain/subdomain, browser/profile, private session, cleared site data, or different computer can require another download. Calling `dispose()` releases runtime resources but does not clear the downloaded model.

## Composition with text-to-data

This package has no dependency on `@matteogiaquinto/text-to-data`. Compose them at the application boundary:

```ts
const text = await speech.stop();
// Then pass `text` to @matteogiaquinto/text-to-data.
```

## Demo

```powershell
pnpm example:dev
```

Open the displayed URL, prepare the French `whisper-base` model, then record a short phrase. The demo is intentionally minimal and intended for real-browser validation.

## License

[MIT](LICENSE). `browser-whisper` is also MIT-licensed and is consumed as a normal dependency; no upstream source is copied into this package.
