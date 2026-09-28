import { afterEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  instances: [] as Array<{
    options: unknown;
    downloadModel: ReturnType<typeof vi.fn>;
    transcribe: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  segments: [{ text: " Bonjour " }, { text: "le monde " }],
}));

vi.mock("browser-whisper", () => ({
  BrowserWhisper: class {
    options: unknown;
    downloadModel = vi.fn().mockResolvedValue(undefined);
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
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: mediaRecorder,
  });
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices,
  });
  engine.instances = [];
  engine.segments = [{ text: " Bonjour " }, { text: "le monde " }];
});

describe("createSpeechToText", () => {
  it("forwards default French configuration and prepares once", async () => {
    const speech = createSpeechToText();
    await speech.prepare();
    await speech.prepare();

    expect(engine.instances).toHaveLength(1);
    expect(engine.instances[0]?.options).toEqual({
      language: "fr",
      model: "whisper-base",
    });
    expect(engine.instances[0]?.downloadModel).toHaveBeenCalledWith({
      model: "whisper-base",
    });
  });

  it("forwards an explicit language and model", async () => {
    const speech = createSpeechToText({
      language: "it",
      model: "whisper-small",
    });
    await speech.prepare();
    expect(engine.instances[0]?.options).toEqual({
      language: "it",
      model: "whisper-small",
    });
  });

  it("records, transcribes, and aggregates segment text", async () => {
    const stopTrack = installMicrophone();
    const speech = createSpeechToText();
    await speech.start();
    await expect(speech.stop()).resolves.toBe("Bonjour le monde");
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("returns an empty string for an empty transcript", async () => {
    installMicrophone();
    engine.segments = [{ text: "  " }];
    const speech = createSpeechToText();
    await speech.start();
    await expect(speech.stop()).resolves.toBe("");
  });

  it("prevents accidental double starts and stop without start", async () => {
    installMicrophone();
    const speech = createSpeechToText();
    await speech.start();
    await expect(speech.start()).rejects.toBeInstanceOf(TranscriptionError);
    await speech.stop();
    await expect(speech.stop()).rejects.toBeInstanceOf(TranscriptionError);
  });

  it("stops microphone tracks when disposed", async () => {
    const stopTrack = installMicrophone();
    const speech = createSpeechToText();
    await speech.prepare();
    await speech.start();
    speech.dispose();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(engine.instances[0]?.dispose).toHaveBeenCalledOnce();
  });

  it("can be imported without browser APIs", async () => {
    await expect(import("../src/index.js")).resolves.toBeDefined();
  });
});
