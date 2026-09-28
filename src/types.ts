export type SpeechToTextStatus =
  "idle" | "loading" | "ready" | "recording" | "transcribing" | "error";

import type { ASRModel } from "browser-whisper";

export interface CreateSpeechToTextOptions {
  /** BCP-47 language code passed to Whisper. Defaults to French. */
  language?: string;
  /** A browser-whisper Whisper model. Defaults to whisper-base. */
  model?: ASRModel;
  /** Receives coarse lifecycle updates. */
  onStatus?: (status: SpeechToTextStatus) => void;
}

export interface SpeechToText {
  /** Downloads and initializes the selected model without opening the microphone. */
  prepare(): Promise<void>;
  /** Requests microphone access and begins a new recording. */
  start(): Promise<void>;
  /** Stops recording, transcribes it locally, and returns plain text. */
  stop(): Promise<string>;
  /** Stops any microphone track and cancels an in-flight transcription. */
  dispose(): void;
}
