# Consumer integration guide

Use this guide when adding `@matteogiaquinto/speech-to-text` to a web application, CRM, form, admin panel, or similar product.

## Intended result

The normal UI is a text field with a microphone control embedded at its far right:

```text
┌──────────────────────────────────────────────┐
│ Existing or dictated text               🎙  │
└──────────────────────────────────────────────┘
```

The microphone must feel like part of the field, not like a separate form action.

For a single-line input, vertically center it at the right edge. Keep enough right padding on the input so text does not overlap the control.

For a textarea, place the control at the right edge in a position consistent with the target design system, normally top-right or bottom-right inside the textarea container.

## Installation

Use the package manager already used by the target repository.

```powershell
pnpm add @matteogiaquinto/speech-to-text
```

Equivalent npm/yarn/bun commands are acceptable when the target repository already uses them. Do not switch package managers just for this package.

## Integration behavior

### Initial state

The field behaves exactly as it did before integration.

The microphone button is visible but no model should be downloaded merely because the page rendered.

### First microphone click

1. Record that the user explicitly requested dictation.
2. Create/reuse the speech-to-text instance.
3. If the model is not prepared in the current runtime, call `prepare()`.
4. While it prepares, show a small loading state in the microphone control.
5. When preparation succeeds, immediately call `start()`.
6. Change the control to a clearly active recording state.

The first preparation may need to obtain a substantial model. Do not hide a long first-time loading state.

### Recording click

While recording, the microphone button acts as the stop button.

On click:

```ts
const transcript = await speech.stop();
```

While `stop()` is processing, show a transcribing/busy state.

### Applying the transcript

Do not destroy text the user has already typed.

Preferred behavior:

1. insert at the current selection/caret if the target field infrastructure makes this reliable;
2. otherwise append to the existing value;
3. use exactly one space between existing text and the new transcript when both are non-empty;
4. restore focus to the field after insertion when appropriate.

Conceptual helper:

```ts
function appendTranscript(current: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return current;
  if (!current.trim()) return cleanTranscript;
  return `${current.trimEnd()} ${cleanTranscript}`;
}
```

For controlled framework inputs, update framework/application state. Do not directly mutate the DOM value.

## Minimal lifecycle

```ts
import { createSpeechToText } from "@matteogiaquinto/speech-to-text";

const speech = createSpeechToText({
  language: "fr",
  onStatus(status) {
    // Keep this small and map to existing product UI.
  },
});

// Explicit user intent:
await speech.prepare();
await speech.start();

// User clicks the control again:
const transcript = await speech.stop();

// Apply transcript to the active field using the application's state model.

// When this feature is permanently unmounted:
speech.dispose();
```

Reuse the same `speech` instance for later recordings. Do not call `dispose()` after every `stop()`.

## UI contract

Use the target application's existing design system.

The microphone control should normally be:

- icon-only;
- inside the field's visual wrapper at the far right;
- keyboard focusable;
- accessible with `aria-label`;
- exposed with the application's normal tooltip pattern;
- visually neutral while idle;
- visibly active while recording;
- a spinner/busy indicator while loading or transcribing;
- disabled against duplicate actions while a non-interruptible operation is in progress.

Do not add a new icon library only for this feature.

Do not change field height, surrounding labels, validation messages, or form spacing unless required to fit the adornment.

## Suggested status mapping

| Package status | Product UI |
| --- | --- |
| `idle` | normal microphone |
| `loading` | loading indicator; prevent duplicate activation |
| `ready` | normal microphone |
| `recording` | active/recording microphone state |
| `transcribing` | busy indicator |
| `error` | restore normal control and show existing product error/notification UI |

Avoid modal dialogs for ordinary microphone denial or transcription errors unless the target product already uses modals for comparable input errors.

## Multiple fields

If only one field has dictation, one instance in that component/feature is fine.

If several fields on the same page have microphone buttons, prefer one shared speech-to-text instance for the page/form:

```text
shared SpeechToText instance
          │
          ├── customer input microphone
          ├── description input microphone
          └── notes input microphone
```

Track the active field separately and insert the returned transcript into that field. Do not load one Whisper runtime for every field.

Only one recording should be active at a time.

## Model download and cache

The default model is `whisper-base`.

The model is not expected to download on every transcription. `browser-whisper` stores model files in origin-private browser storage and reuses them on later visits to the same site.

Treat the cache scope as:

```text
browser profile + site origin
```

Examples:

```text
https://crm.example.com   -> its own cache
https://admin.example.com -> a different origin/cache
Chrome profile A          -> its own cache
Chrome profile B          -> its own cache
another computer          -> its own cache
```

The model can be downloaded again if the user clears site data, uses private browsing, changes browser/profile/device, or uses another origin.

`dispose()` does not clear the downloaded model.

## Deployment requirements

Microphone capture needs a secure browser context in production, normally HTTPS. Localhost is valid during development.

The package inherits browser-whisper's WebGPU/WebCodecs/WASM constraints.

Threaded WASM can require:

```text
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Do not add those headers automatically to every target application. They can affect third-party scripts, embeds, fonts, and other resources. Add them only when required by the deployment/browser fallback being supported, then test the whole application.

## Error behavior

Handle failures without breaking manual input.

Important cases:

- microphone permission denied;
- microphone API unavailable;
- model load failure;
- transcription failure.

After any error, the user must still be able to type normally into the field.

Use existing notification/error components from the target application rather than introducing a new notification system.

## Integration acceptance checklist

Before considering an integration complete, verify:

- package is installed from npm, not copied into the app;
- microphone appears at the far right of the requested input;
- typed text does not overlap the button;
- first explicit use prepares the model and communicates loading;
- recording starts after preparation;
- second activation stops and transcribes;
- transcript is inserted without unexpectedly deleting existing text;
- multiple recordings work with the same instance;
- model is not intentionally re-downloaded for every recording;
- permission denial leaves the field usable;
- cleanup calls `dispose()` on permanent unmount;
- production uses HTTPS;
- existing lint/typecheck/tests/build still pass.

## Out of scope for a normal integration

Do not add these unless the product explicitly asks for them:

- cloud speech APIs;
- a fork of browser-whisper;
- direct Transformers.js inference code;
- speaker diarization;
- long meeting transcription;
- speech synthesis;
- automatic submission of the form after transcription;
- automatic calls to other AI systems merely because transcription completed.

The returned value is plain text. What happens after that belongs to the consumer application.
