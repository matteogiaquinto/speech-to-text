# Consumer integration guide

Use this guide when adding `@matteogiaquinto/speech-to-text` to a web application, CRM, form, admin panel, AI prompt, or similar product.

The canonical microphone visual/interaction specification lives in [`docs/VOICE-UI.md`](./docs/VOICE-UI.md). The public browser demo is the reference implementation.

## Intended result

For an ordinary single-line input:

```text
┌──────────────────────────────────────────────┐
│ Existing or dictated text               🎙  │
└──────────────────────────────────────────────┘
```

For an AI-style prompt or command composer:

```text
┌─────────────────────────────────────────────────────┐
│ Ask anything…                                       │
│                                                     │
│ [language] [model]                         [voice]   │
└─────────────────────────────────────────────────────┘
```

The microphone must feel like part of the field, not like a separate large action.

While recording, the compact microphone morphs into a left-expanding voice capsule with elapsed time, a waveform, and a stop square. Tap-to-latch, hold-to-talk, slide-left-to-cancel, and keyboard controls are defined in `docs/VOICE-UI.md`.

For a single-line input, vertically center the idle control at the right edge and reserve enough room that neither the idle button nor the expanded capsule covers editable text.

For a standard textarea, place the control at the right edge, normally bottom-right.

For an AI-style prompt, use a multiline auto-growing textarea with a bottom toolbar. Put the voice control on the right side of that toolbar, immediately before the send button when the product already has one.

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

### First microphone activation

1. Record that the user explicitly requested dictation.
2. Create/reuse the speech-to-text instance.
3. If the model is not prepared in the current runtime, call `prepare()`.
4. While it prepares, keep the microphone compact and show a small loading spinner.
5. When preparation succeeds, immediately call `start()`.
6. Change the control to the expanded recording capsule.

The first preparation may need to obtain a substantial model. Do not hide a long first-time loading state.

If first-use preparation outlasts a held pointer gesture, finish preparation and latch recording rather than immediately stopping an empty recording.

### Recording interaction

Use the interaction contract from `docs/VOICE-UI.md`:

- short tap: start and latch recording;
- second tap: stop and transcribe;
- hold for about 300 ms: release to stop;
- while held, slide left about 64 px: cancel and discard;
- `Enter` / `Space`: start or stop;
- `Escape`: cancel.

On a normal stop:

```ts
const transcript = await speech.stop();
```

While `stop()` is processing, collapse the active capsule and show a transcribing/busy indicator.

For slide-to-cancel, do not insert a transcript. The current package has no dedicated cancel API; disposing/recreating the active instance is acceptable when true discard behavior is required. The browser model cache remains intact.

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
    // Map package status to the host product's voice-control UI.
  },
});

// Explicit user intent:
await speech.prepare();
await speech.start();

// Normal stop:
const transcript = await speech.stop();

// Apply transcript to the active field using the application's state model.

// Permanent unmount:
speech.dispose();
```

Reuse the same `speech` instance for later recordings. Do not call `dispose()` after every successful `stop()`.

## UI contract

Use the target application's existing design system for colors, typography, icons, tooltips, and focus treatment.

Preserve the canonical voice-control behavior:

- compact microphone at rest;
- approximately 28 px footprint by default;
- pill/circle idle shape;
- recording capsule expands to the left;
- elapsed clock while recording;
- waveform/history visualization while recording;
- microphone morphs to a stop square;
- tap-to-latch plus hold-to-talk;
- slide left to cancel when pointer interaction supports it;
- compact spinner while loading/transcribing;
- keyboard focusability, accessible label, and `aria-pressed`;
- reduced-motion fallback.

Do not add a new icon library only for this feature if the product already has an equivalent microphone icon.

The waveform is visual feedback. If the existing recorder does not expose audio levels, prefer a subtle simulated waveform over opening a second microphone stream only for animation.

## AI-style prompt composer

When the target field is itself an AI/chat/command prompt, use the public demo as the layout reference.

The composer should normally have:

- a rounded neutral surface;
- a multiline textarea that auto-grows to a row limit;
- a bottom toolbar for real product controls;
- the voice pill aligned on the toolbar's right side;
- the existing send action after the voice pill when applicable.

Do not invent model, source, attachment, or effort controls merely for visual similarity. Reuse only capabilities the host product actually has.

## Suggested status mapping

| Package status | Product UI                                                  |
| -------------- | ----------------------------------------------------------- |
| `idle`         | compact microphone                                          |
| `loading`      | compact spinner; prevent duplicate activation               |
| `ready`        | compact microphone                                          |
| `recording`    | expanded capsule with timer + waveform + stop square        |
| `transcribing` | collapsed busy spinner                                      |
| `error`        | compact microphone + existing product error/notification UI |

Avoid modal dialogs for ordinary microphone denial or transcription errors unless the target product already uses modals for comparable input errors.

## Multiple fields

If only one field has dictation, one instance in that component/feature is fine.

If several fields on the same page have microphone buttons, prefer one shared speech-to-text instance for the page/form:

```text
shared SpeechToText instance
          │
          ├── customer input voice pill
          ├── description input voice pill
          └── notes input voice pill
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
- microphone placement follows the target field type;
- idle microphone is compact and integrated into the field/composer;
- recording expands left into the canonical capsule;
- timer, waveform, and stop mark are visible while recording;
- tap-to-latch works;
- second tap stops and transcribes;
- hold-to-talk works after preparation;
- slide-left cancellation discards the result;
- keyboard start/stop/cancel works;
- first explicit use prepares the model and communicates loading;
- transcript insertion preserves existing text;
- multiple recordings reuse the same runtime;
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
