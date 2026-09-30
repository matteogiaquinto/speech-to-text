import {
  createSpeechToText,
  type SpeechToText,
  type SpeechToTextStatus,
} from "@matteogiaquinto/speech-to-text";
import "./style.css";

type DemoModel = "whisper-tiny" | "whisper-base" | "whisper-small";

const HOLD_AFTER = 300;
const CANCEL_DISTANCE = 64;
const SLIDE_MIN = 4;
const WAVE_MAX = 42;
const WAVE_SAMPLE_MS = 52;

const input = document.querySelector<HTMLTextAreaElement>("#speech-input");
const microphone = document.querySelector<HTMLButtonElement>("#microphone");
const statusPill = document.querySelector<HTMLElement>("#status-pill");
const statusText = document.querySelector<HTMLElement>("#status-text");
const hint = document.querySelector<HTMLElement>("#hint");
const language = document.querySelector<HTMLSelectElement>("#language");
const model = document.querySelector<HTMLSelectElement>("#model");
const copyInstall = document.querySelector<HTMLButtonElement>("#copy-install");
const voiceTime = document.querySelector<HTMLElement>("#voice-time");
const voiceWave = document.querySelector<HTMLCanvasElement>("#voice-wave");

if (
  !input ||
  !microphone ||
  !statusPill ||
  !statusText ||
  !hint ||
  !language ||
  !model ||
  !copyInstall ||
  !voiceTime ||
  !voiceWave
) {
  throw new Error("The demo page is missing required elements.");
}

let prepared = false;
let currentStatus: SpeechToTextStatus = "idle";
let speech: SpeechToText;
let pointerId: number | null = null;
let pointerDownX = 0;
let pointerDownAt = 0;
let pointerStartedRecording = false;
let pointerStartedPrepared = false;
let sliding = false;
let stopWhenRecording = false;
let startSequence = 0;
let recordingStartedAt = 0;
let animationFrame = 0;
let lastWaveSample = 0;
let waveHistory: number[] = [];

const statusMessages: Record<SpeechToTextStatus, string> = {
  idle: "Ready when you are",
  loading: "Loading the model…",
  ready: "Model ready",
  recording: "Recording — tap again to transcribe",
  transcribing: "Transcribing locally…",
  error: "Something went wrong — try again",
};

function autoGrowInput() {
  input.style.height = "0px";
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  input.style.overflowY = input.scrollHeight > 132 ? "auto" : "hidden";
}

function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function simulatedLevel(now: number) {
  const t = now / 1000;
  const phrase = Math.max(
    0.1,
    Math.abs(Math.sin(t * 4.7)) * 0.72,
    Math.abs(Math.sin(t * 7.9 + 0.6)) * 0.46,
  );
  return Math.min(1, phrase * (0.78 + Math.sin(t * 1.3) * 0.12));
}

function drawWave(now: number) {
  const rect = voiceWave.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (voiceWave.width !== width || voiceWave.height !== height) {
    voiceWave.width = width;
    voiceWave.height = height;
  }

  if (now - lastWaveSample >= WAVE_SAMPLE_MS) {
    lastWaveSample = now;
    waveHistory.push(simulatedLevel(now));
    if (waveHistory.length > WAVE_MAX) waveHistory.shift();
  }

  const context = voiceWave.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f5f5f5";

  const barWidth = 2 * dpr;
  const gap = 3.3 * dpr;

  for (let index = 0; index < waveHistory.length; index += 1) {
    const value = waveHistory[waveHistory.length - 1 - index];
    const x = width - (index + 1) * gap;
    if (x + barWidth < 0) break;

    const barHeight = Math.max(
      2 * dpr,
      (0.14 + value * 0.86) * height * 0.76,
    );
    const fade = Math.max(0.12, x / Math.max(1, width));

    context.globalAlpha = fade * (0.45 + value * 0.55);
    context.beginPath();
    context.roundRect(
      x,
      (height - barHeight) / 2,
      barWidth,
      barHeight,
      barWidth / 2,
    );
    context.fill();
  }

  context.globalAlpha = 1;
}

function animateVoice(now: number) {
  if (currentStatus !== "recording") {
    animationFrame = 0;
    return;
  }

  voiceTime.textContent = formatClock(now - recordingStartedAt);
  drawWave(now);
  animationFrame = requestAnimationFrame(animateVoice);
}

function startVoiceAnimation() {
  cancelAnimationFrame(animationFrame);
  recordingStartedAt = performance.now();
  lastWaveSample = 0;
  waveHistory = [];
  voiceTime.textContent = "0:00";
  animationFrame = requestAnimationFrame(animateVoice);
}

function stopVoiceAnimation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  waveHistory = [];
  const context = voiceWave.getContext("2d");
  context?.clearRect(0, 0, voiceWave.width, voiceWave.height);
}

function renderStatus(status: SpeechToTextStatus) {
  const previousStatus = currentStatus;
  currentStatus = status;
  statusPill.dataset.state = status;
  statusText.textContent = statusMessages[status];

  const busy = status === "loading" || status === "transcribing";
  const isRecording = status === "recording";

  microphone.dataset.state = status;
  if (busy) microphone.dataset.busy = "";\n  else delete microphone.dataset.busy;
  microphone.setAttribute("aria-pressed", String(isRecording));
  microphone.setAttribute(
    "aria-label",
    isRecording ? "Stop dictation" : "Start dictation",
  );
  microphone.title = isRecording ? "Stop dictation" : "Start dictation";

  language.disabled = busy || isRecording;
  model.disabled = busy || isRecording;

  if (isRecording && previousStatus !== "recording") startVoiceAnimation();
  if (!isRecording && previousStatus === "recording") stopVoiceAnimation();
}

function createEngine(): SpeechToText {
  return createSpeechToText({
    language: language.value,
    model: model.value as DemoModel,
    onStatus: renderStatus,
  });
}

function resetEngine() {
  startSequence += 1;
  speech?.dispose();
  prepared = false;
  stopWhenRecording = false;
  settleSlide();
  speech = createEngine();
  renderStatus("idle");
  hint.textContent =
    "The selected model will be prepared on your next microphone press.";
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
  autoGrowInput();
  input.focus();
  input.setSelectionRange(caret, caret);
  hint.textContent =
    "Transcription inserted locally. Use the microphone again to keep dictating.";
}

function showError(error: unknown) {
  renderStatus("error");
  hint.textContent =
    error instanceof Error
      ? error.message
      : "Speech-to-text failed. Check microphone permissions and try again.";
}

async function startRecording() {
  if (
    currentStatus === "recording" ||
    currentStatus === "loading" ||
    currentStatus === "transcribing"
  ) {
    return;
  }

  const sequence = ++startSequence;

  try {
    if (!prepared) {
      hint.textContent =
        "Preparing the selected model. The first use can take longer…";
      await speech.prepare();
      if (sequence !== startSequence) return;
      prepared = true;
    }

    await speech.start();
    if (sequence !== startSequence) return;

    hint.textContent =
      "Tap again to stop, or hold and slide left to cancel while recording.";

    if (stopWhenRecording) {
      stopWhenRecording = false;
      await stopRecording();
    }
  } catch (error) {
    if (sequence === startSequence) showError(error);
  }
}

async function stopRecording() {
  if (currentStatus !== "recording") return;

  try {
    settleSlide();
    const transcript = await speech.stop();
    insertTranscript(transcript);
  } catch (error) {
    showError(error);
  }
}

function cancelRecording() {
  if (currentStatus !== "recording") return;

  startSequence += 1;
  stopWhenRecording = false;
  settleSlide();
  speech.dispose();
  prepared = false;
  speech = createEngine();
  renderStatus("idle");
  hint.textContent =
    "Recording cancelled. The model stays cached in the browser and will be reloaded on the next use.";
}

function settleSlide() {
  sliding = false;
  microphone.removeAttribute("data-sliding");
  microphone.style.setProperty("--voice-slide", "0px");
  microphone.style.setProperty("--voice-cancel", "0");
}

function updateSlide(clientX: number) {
  if (
    !pointerStartedRecording ||
    currentStatus !== "recording" ||
    pointerId === null
  ) {
    return;
  }

  const delta = clientX - pointerDownX;
  if (!sliding && delta > -SLIDE_MIN) return;

  sliding = true;
  microphone.dataset.sliding = "";
  const pull = Math.min(CANCEL_DISTANCE + 24, Math.max(0, -delta));
  const progress = Math.min(1, pull / CANCEL_DISTANCE);

  microphone.style.setProperty("--voice-slide", `${-pull}px`);
  microphone.style.setProperty("--voice-cancel", progress.toFixed(3));

  if (progress >= 1) cancelRecording();
}

speech = createEngine();
renderStatus("idle");
autoGrowInput();

input.addEventListener("input", autoGrowInput);

microphone.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    !event.isPrimary ||
    pointerId !== null ||
    currentStatus === "loading" ||
    currentStatus === "transcribing"
  ) {
    return;
  }

  pointerId = event.pointerId;
  pointerDownX = event.clientX;
  pointerDownAt = performance.now();
  pointerStartedRecording = currentStatus !== "recording";
  pointerStartedPrepared = prepared;
  stopWhenRecording = false;
  microphone.dataset.pressed = "";

  try {
    microphone.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is a progressive enhancement.
  }

  if (pointerStartedRecording) void startRecording();
});

microphone.addEventListener("pointermove", (event) => {
  if (event.pointerId === pointerId) updateSlide(event.clientX);
});

microphone.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointerId) return;

  const held = performance.now() - pointerDownAt;
  const startedThisPress = pointerStartedRecording;

  pointerId = null;
  microphone.removeAttribute("data-pressed");

  try {
    if (microphone.hasPointerCapture(event.pointerId)) {
      microphone.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Pointer capture is a progressive enhancement.
  }

  if (sliding) settleSlide();
  if (currentStatus !== "recording") {
    if (startedThisPress && pointerStartedPrepared && held >= HOLD_AFTER) {
      stopWhenRecording = true;
    }
    return;
  }

  if (!startedThisPress) {
    void stopRecording();
    return;
  }

  if (pointerStartedPrepared && held >= HOLD_AFTER) {
    void stopRecording();
  }
});

microphone.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  microphone.removeAttribute("data-pressed");
  settleSlide();
  if (currentStatus === "recording") cancelRecording();
});

microphone.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentStatus === "recording") {
    event.preventDefault();
    cancelRecording();
    return;
  }

  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
    event.preventDefault();
    if (currentStatus === "recording") void stopRecording();
    else void startRecording();
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

window.addEventListener("pagehide", () => {
  stopVoiceAnimation();
  speech.dispose();
});
