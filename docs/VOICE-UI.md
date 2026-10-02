# Voice control UI contract

This document defines the canonical microphone control for product integrations of `@matteogiaquinto/speech-to-text`.

The public demo in `examples/browser` is the visual and interaction reference. Consumer applications may adapt colors, typography, and icon assets to their design system, but should preserve the interaction model unless the product explicitly needs something different.

## Default appearance

Idle state:

```text
[ prompt or input content                                      🎙 ]
```

Recording state:

```text
[ prompt or input content                 waveform  0:07   ■ ]
```

The microphone starts as a compact control and morphs into a left-expanding capsule while recording.

Recommended defaults:

| Property            | Default       |
| ------------------- | ------------- |
| footprint           | 28 px         |
| shape               | pill / circle |
| expansion direction | left          |
| expansion animation | about 200 ms  |
| press scale         | 0.95          |
| elapsed clock       | visible       |
| waveform            | visible       |
| slide to cancel     | enabled       |
| cancel distance     | 64 px         |
| hold threshold      | 300 ms        |

The capsule surface should use the surrounding product's neutral control surface. The idle microphone should be visually quiet. The active capsule, waveform, timer, and stop mark should have high enough contrast to make recording state obvious.

## Interaction model

Use an `auto` interaction model:

### Tap

A short tap starts recording and latches it on.

A second tap stops recording, transcribes, and inserts the returned text into the active field.

### Hold

Pressing and holding starts recording.

When the press lasts at least about 300 ms, releasing stops recording and transcribes. This creates push-to-talk behavior without requiring a separate mode.

The first use can spend time preparing/downloading the model. If preparation is still running when the pointer is released, prioritize a predictable first-use experience: finish preparation and latch recording instead of producing an empty hold-to-talk recording.

### Slide to cancel

While a recording was started by the current held pointer, dragging left should move the capsule content with the pointer and progressively reveal a `Cancel` affordance.

Crossing about 64 px cancels the recording and discards the result.

Call `await speech.cancel()` to discard the recording without destroying the prepared Whisper runtime.

Do not apply the transcript after a cancelled gesture.

### Keyboard

- `Enter` or `Space`: start/stop dictation.
- `Escape` while recording: cancel.
- Keep the control focusable and expose `aria-pressed`.

## Visual states

### idle / ready

Show the microphone glyph only.

The control should feel like an input tool, not a primary CTA.

### loading

The model is being prepared.

Keep the capsule compact and replace the microphone glyph with a small spinner. Prevent duplicate start actions. Do not imply that audio is already recording.

### recording

Expand the capsule to the left.

Show:

- elapsed time;
- a small waveform/history visualization;
- a stop square in place of the microphone glyph.

The waveform is feedback, not a precision meter. If the product already has access to microphone levels, use them. If the underlying recorder does not expose levels, a subtle simulated waveform is acceptable; do not open a second microphone stream only for decoration.

### transcribing

Collapse back toward the compact footprint and show a busy spinner.

Do not allow another recording until transcription resolves or fails.

### error

Return to the normal compact microphone.

Leave the text input fully usable and surface the error through the host product's normal non-blocking error pattern.

## Placement

### AI-style prompt composer

For chat, copilots, commands, and AI prompts, use a multiline composer:

```text
┌─────────────────────────────────────────────────────┐
│ Ask anything…                                       │
│                                                     │
│ [language] [model]                         [voice]   │
└─────────────────────────────────────────────────────┘
```

The text area auto-grows up to a reasonable row limit and then scrolls.

Place secondary controls in a bottom toolbar. The voice control belongs on the right side. If the host product already has a send button, put the voice control immediately before the send button.

Do not add fake model/source/effort controls just to imitate an AI product. Reuse only controls that actually exist in the host application.

### Single-line inputs

For ordinary text fields, keep the microphone at the far right inside the field wrapper and vertically centered. The recording capsule expands left over reserved empty space or over a positioned overlay without covering the user's text.

### Textareas

For ordinary multiline textareas, place the control at the right edge, normally bottom-right. Ensure the expanded recording capsule does not cover editable text.

## Transcript insertion

Do not destroy existing user text.

Prefer insertion at the current caret/selection. Otherwise append the transcript with exactly one separating space.

After insertion, restore focus and place the caret after the inserted transcript when practical.

## Shared runtime

The animated voice control is UI. The Whisper runtime should still follow the package integration contract:

- one long-lived `SpeechToText` instance per mounted feature;
- share one instance across several microphone buttons on the same screen when practical;
- only one active recording at a time;
- do not dispose after every successful transcription;
- dispose on permanent unmount.

## Accessibility and reduced motion

- Provide an accessible name equivalent to `Start dictation` / `Stop dictation`.
- Keep `aria-pressed` synchronized with recording state.
- Preserve a visible keyboard focus ring.
- Respect `prefers-reduced-motion`: remove morphing/sliding transforms while keeping clear state changes.
- Do not rely on animation or color alone to communicate that recording is active.

## Acceptance checklist

A microphone integration is visually complete when:

- the idle control is compact and visually belongs to the field;
- recording expands into a capsule toward the left;
- the active state shows a stop mark, elapsed time, and waveform;
- tap-to-latch works;
- second tap stops and transcribes;
- hold-to-talk works after the model is prepared;
- slide-left cancellation discards the recording result;
- keyboard start/stop/cancel works;
- loading and transcribing cannot accidentally trigger duplicate recordings;
- existing text is preserved;
- reduced-motion users still get a clear usable state change.
