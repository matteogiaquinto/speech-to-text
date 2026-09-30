import {
  createSpeechToText,
  type SpeechToText,
  type SpeechToTextStatus,
} from "@matteogiaquinto/speech-to-text";
import "./style.css";

type DemoModel = "whisper-tiny" | "whisper-base" | "whisper-small";

const input = document.querySelector<HTMLInputElement>("#speech-input");
const microphone = document.querySelector<HTMLButtonElement>("#microphone");
const statusPill = document.querySelector<HTMLElement>("#status-pill");
const statusText = document.querySelector<HTMLElement>("#status-text");
const hint = document.querySelector<HTMLElement>("#hint");
const language = document.querySelector<HTMLSelectElement>("#language");
const model = document.querySelector<HTMLSelectElement>("#model");
const copyInstall = document.querySelector<HTMLButtonElement>("#copy-install");

if (
  !input ||
  !microphone ||
  !statusPill ||
  !statusText ||
  !hint ||
  !language ||
  !model ||
  !copyInstall
) {
  throw new Error("The demo page is missing required elements.");
}

let prepared = false;
let currentStatus: SpeechToTextStatus = "idle";
let speech: SpeechToText;

const statusMessages: Record<SpeechToTextStatus, string> = {
  idle: "Ready when you are",
  loading: "Loading the model…",
  ready: "Model ready",
  recording: "Recording — click again to transcribe",
  transcribing: "Transcribing locally…",
  error: "Something went wrong — try again",
};

function renderStatus(status: SpeechToTextStatus) {
  currentStatus = status;
  statusPill.dataset.state = status;
  statusText.textContent = statusMessages[status];

  const busy = status === "loading" || status === "transcribing";
  const isRecording = status === "recording";

  microphone.disabled = busy;
  microphone.dataset.state = status;
  microphone.setAttribute(
    "aria-label",
    isRecording ? "Stop dictation" : "Start dictation",
  );
  microphone.title = isRecording ? "Stop dictation" : "Start dictation";

  language.disabled = busy || isRecording;
  model.disabled = busy || isRecording;
}

function createEngine(): SpeechToText {
  return createSpeechToText({
    language: language.value,
    model: model.value as DemoModel,
    onStatus: renderStatus,
  });
}

function resetEngine() {
  speech?.dispose();
  prepared = false;
  speech = createEngine();
  renderStatus("idle");
  hint.textContent =
    "The selected model will be prepared on your next microphone click.";
}

function insertTranscript(transcript: string) {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) {
    hint.textContent = "No speech was detected. You can try again.";
    return;
  }

  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);

  const prefix = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const suffix = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const insertion = `${prefix}${cleanTranscript}${suffix}`;

  input.value = `${before}${insertion}${after}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const caret = before.length + insertion.length;
  input.focus();
  input.setSelectionRange(caret, caret);
  hint.textContent =
    "Transcription inserted locally. Click the microphone to speak again.";
}

function showError(error: unknown) {
  renderStatus("error");
  hint.textContent =
    error instanceof Error
      ? error.message
      : "Speech-to-text failed. Check microphone permissions and try again.";
}

speech = createEngine();
renderStatus("idle");

microphone.addEventListener("click", async () => {
  if (currentStatus === "loading" || currentStatus === "transcribing") return;

  try {
    if (currentStatus === "recording") {
      const transcript = await speech.stop();
      insertTranscript(transcript);
      return;
    }

    if (!prepared) {
      hint.textContent =
        "Preparing the selected model. The first use can take longer…";
      await speech.prepare();
      prepared = true;
    }

    await speech.start();
    hint.textContent =
      "Speak normally, then click the microphone again to stop and transcribe.";
  } catch (error) {
    showError(error);
  }
});

language.addEventListener("change", resetEngine);
model.addEventListener("change", resetEngine);

copyInstall.addEventListener("click", async () => {
  const command = "pnpm add @matteogiaquinto/speech-to-text";

  try {
    await navigator.clipboard.writeText(command);
    copyInstall.textContent = "Copied";
    window.setTimeout(() => {
      copyInstall.textContent = "Copy";
    }, 1600);
  } catch {
    hint.textContent = command;
  }
});

window.addEventListener("pagehide", () => speech.dispose());
