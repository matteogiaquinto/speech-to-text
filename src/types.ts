export type SpeechToTextStatus =
  "idle" | "loading" | "ready" | "recording" | "transcribing" | "error";

import type { ASRModel } from "browser-whisper";

export type SpeechToTextPreload = "after-load" | "on-demand";
export type SpeechToTextCachePolicy = "single-model" | "keep-all";

export interface CreateSpeechToTextOptions {
  /** BCP-47 language code passed to Whisper. Defaults to French. */
  language?: string;
  /** A browser-whisper Whisper model. Defaults to whisper-base. */
  model?: ASRModel;
  /** Preload after page load/idle time, or prepare on first start(). */
  preload?: SpeechToTextPreload;
  /** Keep only the selected model by default, or preserve all cached models. */
  cachePolicy?: SpeechToTextCachePolicy;
  /** Receives coarse lifecycle updates from explicit user-facing operations. */
  onStatus?: (status: SpeechToTextStatus) => void;
}

export interface SpeechToText {
  /** Whether the selected model is initialized in this runtime. */
  isPrepared(): boolean;
  /** Downloads and initializes the selected model. Safe to call repeatedly. */
  prepare(): Promise<void>;
  /** Ensures the model is prepared, then requests microphone access. */
  start(): Promise<void>;
  /** Stops recording, transcribes it locally, and returns plain text. */
  stop(): Promise<string>;
  /** Best-effort cleanup: discards the operation and resolves after tracks are released. */
  cancel(): Promise<void>;
  /** Stops tracks, cancels preparation/transcription, and releases resources. */
  dispose(): void;
}
