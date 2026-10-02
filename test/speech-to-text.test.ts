import { afterEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  instances: [] as Array<{
    options: unknown;
    downloadModel: ReturnType<typeof vi.fn>;
    transcribe: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  deleteModel: vi.fn().mockResolvedValue(undefined),
  segments: [{ text: " Bonjour " }, { text: "le monde " }],
  preparation: undefined as Promise<void> | undefined,
}));

vi.mock("browser-whisper", () => ({
  MODELS: {
    "whisper-tiny": {},
    "whisper-base": {},
    "whisper-small": {},
  },
  BrowserWhisper: class {
    static deleteModel = engine.deleteModel;
    options: unknown;
    downloadModel = vi.fn(() => engine.preparation ?? Promise.resolve());
    transcribe = vi.fn(() => ({
      collect: vi.fn().mockResolvedValue(engine.segments),
      cancel: vi.fn(),
    }));
    dispose = vi.fn();
    constructor(options: unknown) {
      this.options = options;
      engine.instances.push(this);
    }
  },
}));

import { createSpeechToText, TranscriptionError } from "../src/index.js";

class FakeMediaRecorder {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event & { error?: Error }) => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) } as BlobEvent);
    this.onstop?.();
  }
}

const mediaRecorder = globalThis.MediaRecorder;
const mediaDevices = globalThis.navigator.mediaDevices;

function installMicrophone() {
  const stop = vi.fn();
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: FakeMediaRecorder,
  });
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  });
  return stop;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: mediaRecorder,
  });
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices,
  });
  engine.instances = [];
  engine.deleteModel.mockClear();
  engine.segments = [{ text: " Bonjour " }, { text: "le monde " }];
  engine.preparation = undefined;
});

describe("createSpeechToText", () => {
  it("invalidates a pending start while retaining completed preparation", async () => {
    installMicrophone();
    let finish!: () => void;
    engine.preparation = new Promise((resolve) => {
      finish = resolve;
    });
    const speech = createSpeechToText({ preload: "on-demand" });
    const start = speech.start();
    await vi.waitFor(() =>
      expect(engine.instances[0]?.downloadModel).toHaveBeenCalledOnce(),
    );
    await expect(speech.start()).rejects.toBeInstanceOf(TranscriptionError);
    await speech.cancel();
    finish();
    await start;
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(speech.isPrepared()).toBe(true);
    await speech.start();
    await speech.stop();
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledOnce();
  });

  it("does not revive preparation or status after disposal", async () => {
    let finish!: () => void;
    engine.preparation = new Promise((resolve) => {
      finish = resolve;
    });
    const status = vi.fn();
    const speech = createSpeechToText({
      preload: "on-demand",
      onStatus: status,
    });
    const preparation = speech.prepare();
    await vi.waitFor(() =>
      expect(engine.instances[0]?.downloadModel).toHaveBeenCalledOnce(),
    );
    speech.dispose();
    finish();
    await preparation;
    expect(speech.isPrepared()).toBe(false);
    expect(status).toHaveBeenLastCalledWith("idle");
  });

  it("recovers after transcription failure without losing the model", async () => {
    const release = installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    engine.instances[0]!.transcribe.mockReturnValueOnce({
      collect: () => Promise.reject(new Error("inference failed")),
      cancel: vi.fn(),
    });
    await expect(speech.stop()).rejects.toBeInstanceOf(TranscriptionError);
    expect(release).toHaveBeenCalledOnce();
    expect(speech.isPrepared()).toBe(true);
    await speech.start();
    expect(await speech.stop()).toBe("Bonjour le monde");
  });
  it("cancels capture, releases tracks, and reuses the prepared engine", async () => {
    const release = installMicrophone();
    const status = vi.fn();
    const speech = createSpeechToText({
      preload: "on-demand",
      onStatus: status,
    });
    await speech.start();
    await speech.cancel();
    await speech.cancel();
    expect(release).toHaveBeenCalledOnce();
    expect(engine.instances[0]?.transcribe).not.toHaveBeenCalled();
    expect(engine.instances[0]?.dispose).not.toHaveBeenCalled();
    expect(speech.isPrepared()).toBe(true);
    expect(status).toHaveBeenLastCalledWith("ready");
    await speech.start();
    expect(await speech.stop()).toBe("Bonjour le monde");
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledOnce();
    speech.dispose();
    await speech.cancel();
    await expect(speech.start()).rejects.toBeInstanceOf(TranscriptionError);
  });
  it("public cancellation resolves after recorder cleanup errors", async () => {
    const release = installMicrophone();
    class ThrowingRecorder extends FakeMediaRecorder {
      override stop() {
        this.state = "inactive";
        throw new Error("stop failed after cleanup");
      }
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: ThrowingRecorder,
    });
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    await expect(speech.cancel()).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledOnce();
    expect(speech.isPrepared()).toBe(true);
  });

  it("cancels an initiated stop before transcription", async () => {
    installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    const result = speech.stop();
    await speech.cancel();
    expect(await result).toBe("");
    expect(engine.instances[0]?.transcribe).not.toHaveBeenCalled();
    await speech.start();
    await speech.stop();
  });

  it("suppresses late transcription and allows reuse", async () => {
    installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    let finish!: (segments: { text: string }[]) => void;
    const cancel = vi.fn();
    engine.instances[0]!.transcribe.mockReturnValueOnce({
      collect: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      cancel,
    });
    const result = speech.stop();
    await vi.waitFor(() => expect(finish).toBeDefined());
    await speech.cancel();
    expect(await result).toBe("");
    expect(cancel).toHaveBeenCalledOnce();
    await speech.start();
    finish([{ text: "must not appear" }]);
    expect(await speech.stop()).toBe("Bonjour le monde");
  });

  it("releases microphone tracks acquired after cancellation", async () => {
    const release = installMicrophone();
    let grant!: (stream: unknown) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    const speech = createSpeechToText({ preload: "on-demand" });
    const start = speech.start();
    await vi.waitFor(() => expect(grant).toBeDefined());
    await speech.cancel();
    grant({ getTracks: () => [{ stop: release }] });
    await start;
    expect(release).toHaveBeenCalledOnce();
    await speech.start();
    speech.dispose();
  });

  it("does not restore readiness after disposal during inference", async () => {
    installMicrophone();
    const status = vi.fn();
    const speech = createSpeechToText({
      preload: "on-demand",
      onStatus: status,
    });
    await speech.start();
    engine.instances[0]!.transcribe.mockReturnValueOnce({
      collect: () => new Promise(() => {}),
      cancel: vi.fn(),
    });
    const result = speech.stop();
    await vi.waitFor(() =>
      expect(status).toHaveBeenLastCalledWith("transcribing"),
    );
    speech.dispose();
    expect(await result).toBe("");
    expect(status).toHaveBeenLastCalledWith("idle");
  });
  it("forwards defaults and keeps prepare single-flight/idempotent", async () => {
    const speech = createSpeechToText({ preload: "on-demand" });

    expect(speech.isPrepared()).toBe(false);
    await Promise.all([speech.prepare(), speech.prepare()]);
    await speech.prepare();

    expect(speech.isPrepared()).toBe(true);
    expect(engine.instances).toHaveLength(1);
    expect(engine.instances[0]?.options).toEqual({
      language: "fr",
      model: "whisper-base",
    });
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledTimes(1);
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledWith({
      model: "whisper-base",
      signal: expect.any(AbortSignal),
    });
  });

  it("forwards an explicit language and model", async () => {
    const speech = createSpeechToText({
      language: "it",
      model: "whisper-small",
      preload: "on-demand",
    });
    await speech.prepare();
    expect(engine.instances[0]?.options).toEqual({
      language: "it",
      model: "whisper-small",
    });
  });

  it("prepares automatically on first start in on-demand mode", async () => {
    installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });

    expect(engine.instances).toHaveLength(0);
    await speech.start();

    expect(speech.isPrepared()).toBe(true);
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledTimes(1);
  });

  it("preloads silently after page load by default", async () => {
    const onStatus = vi.fn();
    const fakeWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
      clearTimeout: vi.fn(),
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", { readyState: "complete" });

    const speech = createSpeechToText({ onStatus });

    await vi.waitFor(() => expect(speech.isPrepared()).toBe(true));
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledTimes(1);
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("records, transcribes, and aggregates segment text", async () => {
    const stopTrack = installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    await expect(speech.stop()).resolves.toBe("Bonjour le monde");
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("returns an empty string for an empty transcript", async () => {
    installMicrophone();
    engine.segments = [{ text: "  " }];
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    await expect(speech.stop()).resolves.toBe("");
  });

  it("prevents accidental double starts and stop without start", async () => {
    installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    await expect(speech.start()).rejects.toBeInstanceOf(TranscriptionError);
    await speech.stop();
    await expect(speech.stop()).rejects.toBeInstanceOf(TranscriptionError);
  });

  it("stops microphone tracks and resets prepared state when disposed", async () => {
    const stopTrack = installMicrophone();
    const speech = createSpeechToText({ preload: "on-demand" });
    await speech.start();
    speech.dispose();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(speech.isPrepared()).toBe(false);
    expect(engine.instances[0]?.dispose).toHaveBeenCalledOnce();
  });

  it("can be imported without browser APIs", async () => {
    await expect(import("../src/index.js")).resolves.toBeDefined();
  });
});
