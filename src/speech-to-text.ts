import { TranscriptionError } from "./errors.js";
import { createRecorder } from "./recorder.js";
import type {
  CreateSpeechToTextOptions,
  SpeechToText,
  SpeechToTextStatus,
} from "./types.js";
import type { BrowserWhisper, TranscribeStream } from "browser-whisper";

const DEFAULT_LANGUAGE = "fr";
const DEFAULT_MODEL = "whisper-base";

export function createSpeechToText(
  options: CreateSpeechToTextOptions = {},
): SpeechToText {
  const language = options.language ?? DEFAULT_LANGUAGE;
  const model = options.model ?? DEFAULT_MODEL;
  const recorder = createRecorder();
  let whisper: BrowserWhisper | undefined;
  let activeStream: TranscribeStream | undefined;
  let disposed = false;
  let recording = false;

  const setStatus = (status: SpeechToTextStatus) => options.onStatus?.(status);

  const getWhisper = async () => {
    if (disposed)
      throw new TranscriptionError(
        "This speech-to-text instance has been disposed.",
      );
    if (!whisper) {
      const { BrowserWhisper } = await import("browser-whisper");
      whisper = new BrowserWhisper({ model, language });
    }
    return whisper;
  };

  return {
    async prepare() {
      setStatus("loading");
      try {
        const engine = await getWhisper();
        await engine.downloadModel({ model });
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        throw new TranscriptionError(
          "The Whisper model could not be prepared.",
          { cause: error },
        );
      }
    },

    async start() {
      if (disposed)
        throw new TranscriptionError(
          "This speech-to-text instance has been disposed.",
        );
      if (recording)
        throw new TranscriptionError("A recording is already in progress.");
      await recorder.start();
      recording = true;
      setStatus("recording");
    },

    async stop() {
      if (!recording)
        throw new TranscriptionError("No recording is in progress.");
      let audio: Blob;
      try {
        audio = await recorder.stop();
      } finally {
        recording = false;
      }

      setStatus("transcribing");
      try {
        const engine = await getWhisper();
        const file = new File([audio], "speech.webm", {
          type: audio.type || "audio/webm",
        });
        activeStream = engine.transcribe(file);
        const segments = await activeStream.collect();
        activeStream = undefined;
        setStatus("ready");
        return segments
          .map((segment) => segment.text.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
      } catch (error) {
        activeStream = undefined;
        setStatus("error");
        throw new TranscriptionError(
          "The recording could not be transcribed.",
          { cause: error },
        );
      }
    },

    dispose() {
      disposed = true;
      recording = false;
      activeStream?.cancel?.();
      activeStream = undefined;
      recorder.dispose();
      whisper?.dispose();
      whisper = undefined;
      setStatus("idle");
    },
  };
}
