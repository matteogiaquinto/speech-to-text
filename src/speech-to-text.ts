import { TranscriptionError } from "./errors.js";
import { scheduleModelCacheMaintenance } from "./model-cache.js";
import { createRecorder } from "./recorder.js";
import type {
  CreateSpeechToTextOptions,
  SpeechToText,
  SpeechToTextStatus,
} from "./types.js";
import type {
  BrowserWhisper,
  DownloadModelOptions,
  TranscribeStream,
} from "browser-whisper";

const DEFAULT_LANGUAGE = "fr";
const DEFAULT_MODEL = "whisper-base";
const DEFAULT_PRELOAD = "after-load";
const DEFAULT_CACHE_POLICY = "single-model";

let browserWhisperModulePromise:
  Promise<typeof import("browser-whisper")> | undefined;

export function createSpeechToText(
  options: CreateSpeechToTextOptions = {},
): SpeechToText {
  const language = options.language ?? DEFAULT_LANGUAGE;
  const model = options.model ?? DEFAULT_MODEL;
  const preload = options.preload ?? DEFAULT_PRELOAD;
  const cachePolicy = options.cachePolicy ?? DEFAULT_CACHE_POLICY;
  const recorder = createRecorder();
  let whisper: BrowserWhisper | undefined;
  let activeStream: TranscribeStream | undefined;
  let preparePromise: Promise<void> | undefined;
  let prepareController: AbortController | undefined;
  let prepared = false;
  let disposed = false;
  let recording = false;
  let cancelScheduledPreload: () => void = () => undefined;

  const setStatus = (status: SpeechToTextStatus) => options.onStatus?.(status);

  const getBrowserWhisperModule = () => {
    browserWhisperModulePromise ??= import("browser-whisper");
    return browserWhisperModulePromise;
  };

  const getWhisper = async () => {
    if (disposed) {
      throw new TranscriptionError(
        "This speech-to-text instance has been disposed.",
      );
    }
    if (!whisper) {
      const { BrowserWhisper } = await getBrowserWhisperModule();
      if (disposed) {
        throw new TranscriptionError(
          "This speech-to-text instance has been disposed.",
        );
      }
      whisper = new BrowserWhisper({ model, language });
    }
    return whisper;
  };

  const ensurePrepared = async (reportStatus: boolean) => {
    if (disposed) {
      throw new TranscriptionError(
        "This speech-to-text instance has been disposed.",
      );
    }

    if (prepared) {
      if (reportStatus) setStatus("ready");
      return;
    }

    if (reportStatus) setStatus("loading");

    try {
      preparePromise ??= (async () => {
        const engine = await getWhisper();
        const browserWhisper = await getBrowserWhisperModule();
        prepareController = new AbortController();
        const downloadOptions: DownloadModelOptions = {
          model,
          signal: prepareController.signal,
        };

        await engine.downloadModel(downloadOptions);
        prepared = true;
        scheduleModelCacheMaintenance(browserWhisper, model, cachePolicy);
      })().finally(() => {
        prepareController = undefined;
        preparePromise = undefined;
      });

      await preparePromise;
      if (reportStatus) setStatus("ready");
    } catch (error) {
      if (reportStatus) setStatus("error");
      throw new TranscriptionError("The Whisper model could not be prepared.", {
        cause: error,
      });
    }
  };

  const speech: SpeechToText = {
    isPrepared() {
      return prepared;
    },

    async prepare() {
      await ensurePrepared(true);
    },

    async start() {
      if (disposed) {
        throw new TranscriptionError(
          "This speech-to-text instance has been disposed.",
        );
      }
      if (recording) {
        throw new TranscriptionError("A recording is already in progress.");
      }

      await ensurePrepared(true);
      await recorder.start();
      recording = true;
      setStatus("recording");
    },

    async stop() {
      if (!recording) {
        throw new TranscriptionError("No recording is in progress.");
      }
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
      prepared = false;
      recording = false;
      cancelScheduledPreload();
      prepareController?.abort();
      prepareController = undefined;
      activeStream?.cancel?.();
      activeStream = undefined;
      recorder.dispose();
      whisper?.dispose();
      whisper = undefined;
      setStatus("idle");
    },
  };

  if (preload === "after-load") {
    cancelScheduledPreload = scheduleAfterPageLoad(() => {
      void ensurePrepared(false).catch(() => undefined);
    });
  }

  return speech;
}

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleAfterPageLoad(task: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const idleWindow = window as IdleCapableWindow;
  let cancelled = false;
  let idleHandle: number | undefined;
  let timeoutHandle: number | undefined;

  const runWhenIdle = () => {
    if (cancelled) return;

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(
        () => {
          if (!cancelled) task();
        },
        { timeout: 4000 },
      );
      return;
    }

    timeoutHandle = window.setTimeout(() => {
      if (!cancelled) task();
    }, 1500);
  };

  if (document.readyState === "complete") runWhenIdle();
  else window.addEventListener("load", runWhenIdle, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", runWhenIdle);
    if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
    if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
  };
}
