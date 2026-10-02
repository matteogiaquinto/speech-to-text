import { MicrophoneError, SpeechToTextError } from "./errors.js";

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  cancel(): void;
  dispose(): void;
}

export function createRecorder(): Recorder {
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let chunks: Blob[] = [];
  let generation = 0;
  let settleStop: ((audio: Blob) => void) | undefined;

  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  };

  const cancel = () => {
    generation += 1;
    const active = recorder;
    recorder = undefined;
    if (active) {
      active.ondataavailable = null;
      active.onstop = null;
      active.onerror = null;
      if (active.state === "recording") active.stop();
    }
    chunks = [];
    stopTracks();
    settleStop?.(new Blob([]));
    settleStop = undefined;
  };

  return {
    async start() {
      if (recorder?.state === "recording") {
        throw new SpeechToTextError("A recording is already in progress.");
      }
      if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
        throw new MicrophoneError(
          "Microphone recording is unavailable in this browser.",
        );
      }
      if (typeof globalThis.MediaRecorder === "undefined") {
        throw new MicrophoneError(
          "MediaRecorder is unavailable in this browser.",
        );
      }

      const token = generation;
      try {
        const acquired = await globalThis.navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (token !== generation) {
          acquired.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = acquired;
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.start();
      } catch (error) {
        stopTracks();
        throw new MicrophoneError(
          "Microphone access was denied or could not be started.",
          {
            cause: error,
          },
        );
      }
    },

    stop() {
      if (!recorder || recorder.state !== "recording") {
        return Promise.reject(
          new SpeechToTextError("No recording is in progress."),
        );
      }

      return new Promise<Blob>((resolve, reject) => {
        settleStop = resolve;
        const activeRecorder = recorder;
        if (!activeRecorder) {
          reject(new SpeechToTextError("No recording is in progress."));
          return;
        }
        activeRecorder.onstop = () => {
          const type = activeRecorder.mimeType || "audio/webm";
          recorder = undefined;
          stopTracks();
          resolve(new Blob(chunks, { type }));
          chunks = [];
          settleStop = undefined;
        };
        activeRecorder.onerror = (event) => {
          recorder = undefined;
          stopTracks();
          chunks = [];
          settleStop = undefined;
          reject(
            new MicrophoneError("Microphone recording failed.", {
              cause: event.error,
            }),
          );
        };
        try {
          activeRecorder.stop();
        } catch (error) {
          recorder = undefined;
          chunks = [];
          settleStop = undefined;
          stopTracks();
          reject(
            new MicrophoneError("Microphone recording failed.", {
              cause: error,
            }),
          );
        }
      });
    },

    cancel,
    dispose: cancel,
  };
}
