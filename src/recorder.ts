import { MicrophoneError, SpeechToTextError } from "./errors.js";

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  dispose(): void;
}

export function createRecorder(): Recorder {
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let chunks: Blob[] = [];

  const stopTracks = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
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

      try {
        stream = await globalThis.navigator.mediaDevices.getUserMedia({
          audio: true,
        });
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
        };
        activeRecorder.onerror = (event) => {
          recorder = undefined;
          stopTracks();
          reject(
            new MicrophoneError("Microphone recording failed.", {
              cause: event.error,
            }),
          );
        };
        activeRecorder.stop();
      });
    },

    dispose() {
      if (recorder?.state === "recording") recorder.stop();
      recorder = undefined;
      chunks = [];
      stopTracks();
    },
  };
}
