export class SpeechToTextError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SpeechToTextError";
  }
}

export class MicrophoneError extends SpeechToTextError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MicrophoneError";
  }
}

export class TranscriptionError extends SpeechToTextError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TranscriptionError";
  }
}
