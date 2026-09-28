import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrophoneError, SpeechToTextError } from "../src/errors.js";
import { createRecorder } from "../src/recorder.js";

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event & { error?: Error }) => void) | null = null;

  constructor(readonly stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }

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
  FakeMediaRecorder.instances = [];
});

describe("createRecorder", () => {
  it("records a blob and stops microphone tracks", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const recorder = createRecorder();

    await recorder.start();
    const audio = await recorder.stop();

    expect(audio.size).toBeGreaterThan(0);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("returns a clear error when microphone permission fails", async () => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });

    await expect(createRecorder().start()).rejects.toBeInstanceOf(
      MicrophoneError,
    );
  });

  it("rejects stop when not recording", async () => {
    await expect(createRecorder().stop()).rejects.toBeInstanceOf(
      SpeechToTextError,
    );
  });
});
