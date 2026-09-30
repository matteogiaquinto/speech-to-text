import {
  createSpeechToText,
  type SpeechToText,
  type SpeechToTextStatus,
} from "@matteogiaquinto/speech-to-text";
import { GlideSelect } from "./glide-select";
import { initSideRays } from "./side-rays";
import "./style.css";

type DemoModel = "whisper-tiny" | "whisper-base" | "whisper-small";

const HOLD_AFTER = 300;
const CANCEL_DISTANCE = 64;
const SLIDE_MIN = 4;
const WAVE_MAX = 42;
const WAVE_SAMPLE_MS = 52;

type DotGridState = {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  visible: boolean;
  inactive: number[];
  active: number[];
};

type EaseState = {
  value: number;
  from: number;
  to: number;
  start: number;
};

type ClickSpark = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
};

export function initClickSpark() {
  const container = document.querySelector<HTMLElement>(
    "[data-click-spark-color]",
  );
  const canvas = container?.querySelector<HTMLCanvasElement>(
    ".click-spark__canvas",
  );
  if (!container || !canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const color = container.dataset.clickSparkColor ?? "#ffffff";
  const sparkSize = Number(container.dataset.clickSparkSize ?? 10);
  const sparkRadius = Number(container.dataset.clickSparkRadius ?? 10);
  const sparkCount = Number(container.dataset.clickSparkCount ?? 6);
  const duration = Number(container.dataset.clickSparkDuration ?? 300);
  const extraScale = Number(container.dataset.clickSparkExtraScale ?? 2);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const sparks: ClickSpark[] = [];
  let animationFrame = 0;
  let deviceScale = 1;

  function resize() {
    const bounds = container.getBoundingClientRect();
    deviceScale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * deviceScale);
    canvas.height = Math.round(bounds.height * deviceScale);
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  }

  function draw(timestamp: number) {
    const bounds = container.getBoundingClientRect();
    context.clearRect(0, 0, bounds.width, bounds.height);

    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      const spark = sparks[index];
      const elapsed = timestamp - spark.startTime;
      if (elapsed >= duration) {
        sparks.splice(index, 1);
        continue;
      }

      const progress = elapsed / duration;
      const eased = progress * (2 - progress);
      const distance = eased * sparkRadius * extraScale;
      const lineLength = sparkSize * (1 - eased);
      const cosine = Math.cos(spark.angle);
      const sine = Math.sin(spark.angle);

      context.globalAlpha = 1 - progress;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(spark.x + distance * cosine, spark.y + distance * sine);
      context.lineTo(
        spark.x + (distance + lineLength) * cosine,
        spark.y + (distance + lineLength) * sine,
      );
      context.stroke();
    }
    context.globalAlpha = 1;

    if (sparks.length) animationFrame = requestAnimationFrame(draw);
    else animationFrame = 0;
  }

  container.addEventListener("click", (event) => {
    if (reducedMotion.matches) return;

    const bounds = container.getBoundingClientRect();
    const now = performance.now();
    for (let index = 0; index < sparkCount; index += 1) {
      sparks.push({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        angle: (Math.PI * 2 * index) / sparkCount,
        startTime: now,
      });
    }

    if (!animationFrame) animationFrame = requestAnimationFrame(draw);
  });

  new ResizeObserver(resize).observe(container);
  resize();
}

export function initInteractiveDotsGridBackground() {
  const elements = document.querySelectorAll<HTMLElement>(
    "[data-dots-canvas-init]",
  );
  if (!elements.length) return;

  const gap = "1.15em";
  const dotSize = "0.1em";
  const dotMaxScale = 1.75;
  const pressScale = 1.5;
  const hoverRadius = 12;
  const easeDuration = 0.5;
  const hasPointer =
    matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, currentX: 0, currentY: 0, active: false };
  const hover: EaseState = { value: 0, from: 0, to: 0, start: 0 };
  const press: EaseState = { value: 0, from: 0, to: 0, start: 0 };
  const grids: DotGridState[] = [];

  let deviceScale = 1;
  let size = 1;
  let spacing = 1;
  let radius = 1;
  let animationFrameId = 0;
  let lastTime = performance.now();

  function toPixels(value: string, element: HTMLElement) {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;width:${value};`;
    element.appendChild(probe);
    const pixels = probe.getBoundingClientRect().width;
    probe.remove();
    return pixels;
  }

  function parseColor(color: string, element: HTMLElement) {
    const probe = document.createElement("span");
    probe.style.color = color;
    element.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return [255, 255, 255, 0];

    context.fillStyle = resolved;
    context.fillRect(0, 0, 1, 1);
    const values = [...context.getImageData(0, 0, 1, 1).data];
    values[3] /= 255;
    return values;
  }

  function mixColor(start: number[], end: number[], progress: number) {
    return `rgba(${start
      .map((value, index) => value + (end[index] - value) * progress)
      .join(",")})`;
  }

  function setEase(state: EaseState, target: number) {
    Object.assign(state, {
      from: state.value,
      to: target,
      start: performance.now(),
    });
  }

  function updateEase(state: EaseState, time: number) {
    const progress = Math.min(
      Math.max((time - state.start) / (easeDuration * 1000), 0),
      1,
    );
    state.value =
      state.from + (state.to - state.from) * (1 - Math.pow(1 - progress, 4));
  }

  elements.forEach((element) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    element.prepend(canvas);

    grids.push({
      element,
      canvas,
      context,
      width: 0,
      height: 0,
      visible: false,
      inactive: parseColor(
        element.dataset.dotsColorInactive ?? "rgba(255, 255, 255, 0.055)",
        element,
      ),
      active: parseColor(
        element.dataset.dotsColorActive ?? "rgba(255, 255, 255, 0.2)",
        element,
      ),
    });
  });

  function pointerInside() {
    return grids.some(({ element }) => {
      const bounds = element.getBoundingClientRect();
      return (
        pointer.x >= bounds.left &&
        pointer.x <= bounds.right &&
        pointer.y >= bounds.top &&
        pointer.y <= bounds.bottom
      );
    });
  }

  function render(state: DotGridState, origin: DOMRect) {
    const bounds = state.element.getBoundingClientRect();
    const left = bounds.left - origin.left;
    const top = bounds.top - origin.top;
    const pointerX = pointer.currentX - origin.left;
    const pointerY = pointer.currentY - origin.top;
    const maxScale = dotMaxScale * (1 + (pressScale - 1) * press.value);

    state.context.clearRect(0, 0, state.width, state.height);

    const columnStart = Math.floor(left / spacing);
    const columnEnd = Math.ceil((left + state.width) / spacing);
    const rowStart = Math.floor(top / spacing);
    const rowEnd = Math.ceil((top + state.height) / spacing);

    for (let row = rowStart; row <= rowEnd; row += 1) {
      const gridY = row * spacing;
      const y = gridY - top;

      for (let column = columnStart; column <= columnEnd; column += 1) {
        const gridX = column * spacing;
        const x = gridX - left;
        const influence =
          hasPointer && hover.value
            ? Math.max(
                0,
                1 - Math.hypot(gridX - pointerX, gridY - pointerY) / radius,
              ) * hover.value
            : 0;
        const currentSize = size * (1 + (maxScale - 1) * influence);

        state.context.fillStyle = mixColor(
          state.inactive,
          state.active,
          influence,
        );
        state.context.beginPath();
        state.context.arc(x, y, currentSize / 2, 0, Math.PI * 2);
        state.context.fill();
      }
    }
  }

  function renderAll(visibleOnly = false) {
    const origin = elements[0].getBoundingClientRect();
    grids.forEach((state) => {
      if (!visibleOnly || state.visible) render(state, origin);
    });
  }

  function tick(time: number) {
    animationFrameId = 0;
    if (!grids.some((state) => state.visible)) return;

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    updateEase(hover, time);
    updateEase(press, time);

    const strength = 1 - Math.exp((-delta * 6) / easeDuration);
    pointer.currentX += (pointer.x - pointer.currentX) * strength;
    pointer.currentY += (pointer.y - pointer.currentY) * strength;

    renderAll(true);
    animationFrameId = requestAnimationFrame(tick);
  }

  function start() {
    if (
      hasPointer &&
      !animationFrameId &&
      grids.some((state) => state.visible)
    ) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(tick);
    }
  }

  function resize() {
    deviceScale = Math.min(devicePixelRatio || 1, 2);
    size = toPixels(dotSize, elements[0]);
    spacing = size + toPixels(gap, elements[0]);
    radius = spacing * hoverRadius;

    grids.forEach((state) => {
      const bounds = state.element.getBoundingClientRect();
      state.width = bounds.width;
      state.height = bounds.height;
      state.canvas.width = Math.round(bounds.width * deviceScale);
      state.canvas.height = Math.round(bounds.height * deviceScale);
      state.context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    });

    renderAll();
    start();
  }

  if (hasPointer) {
    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const inside = pointerInside();

      if (inside !== pointer.active) {
        pointer.active = inside;
        setEase(hover, Number(inside));

        if (inside) {
          pointer.currentX = pointer.x;
          pointer.currentY = pointer.y;
        } else {
          setEase(press, 0);
        }
      }

      start();
    });
    window.addEventListener("pointerdown", () => {
      if (pointer.active) setEase(press, 1);
    });
    window.addEventListener("pointerup", () => setEase(press, 0));
  }

  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const state = grids.find(({ element }) => element === entry.target);
      if (state) state.visible = entry.isIntersecting;
    });
    if (hasPointer) start();
    else renderAll(true);
  });
  const resizeObserver = new ResizeObserver(resize);

  elements.forEach((element) => {
    intersectionObserver.observe(element);
    resizeObserver.observe(element);
  });
  window.addEventListener("resize", resize);
  resize();
}

function initPromptComposerBorderGlow() {
  const composer = document.querySelector<HTMLElement>(".prompt-composer");
  if (!composer) return;

  const supportsHover = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function resetGlow() {
    composer.style.setProperty("--border-glow-proximity", "0");
  }

  composer.addEventListener("pointermove", (event) => {
    if (!supportsHover.matches || reducedMotion.matches) return;

    const bounds = composer.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const distanceFromEdge = Math.min(
      x,
      y,
      bounds.width - x,
      bounds.height - y,
    );
    const proximity = Math.max(
      0,
      Math.min(100, (1 - distanceFromEdge / 42) * 100),
    );
    const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 90;

    composer.style.setProperty("--border-glow-proximity", proximity.toFixed(2));
    composer.style.setProperty("--border-glow-angle", `${angle.toFixed(2)}deg`);
  });

  composer.addEventListener("pointerleave", resetGlow);
  supportsHover.addEventListener("change", resetGlow);
  reducedMotion.addEventListener("change", resetGlow);
}

const input = document.querySelector<HTMLTextAreaElement>("#speech-input");
const microphone = document.querySelector<HTMLButtonElement>("#microphone");
const statusPill = document.querySelector<HTMLElement>("#status-pill");
const statusText = document.querySelector<HTMLElement>("#status-text");
const hint = document.querySelector<HTMLElement>("#hint");
const languageRoot = document.querySelector<HTMLElement>("#language");
const modelRoot = document.querySelector<HTMLElement>("#model");
const copyInstall = document.querySelector<HTMLButtonElement>("#copy-install");
const voiceTime = document.querySelector<HTMLElement>("#voice-time");
const voiceWave = document.querySelector<HTMLCanvasElement>("#voice-wave");
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");

if (
  !input ||
  !microphone ||
  !statusPill ||
  !statusText ||
  !hint ||
  !languageRoot ||
  !modelRoot ||
  !copyInstall ||
  !voiceTime ||
  !voiceWave
) {
  throw new Error("The demo page is missing required elements.");
}

function setTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  const light = theme === "light";
  themeToggle?.setAttribute("aria-pressed", String(light));
  themeToggle?.setAttribute(
    "aria-label",
    light ? "Switch to dark mode" : "Switch to light mode",
  );
  themeToggle?.setAttribute(
    "title",
    light ? "Switch to dark mode" : "Switch to light mode",
  );
  try {
    localStorage.setItem("speech-to-text-theme", theme);
  } catch {
    // Theme persistence is an enhancement when storage is unavailable.
  }
}

setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
themeToggle?.addEventListener("click", () => {
  setTheme(
    document.documentElement.dataset.theme === "light" ? "dark" : "light",
  );
});

const language = new GlideSelect(languageRoot, {
  ariaLabel: "Language",
  value: "fr",
  options: [
    { value: "fr", label: "French" },
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "es", label: "Spanish" },
  ],
  onChange: () => resetEngine(),
});
const model = new GlideSelect(modelRoot, {
  ariaLabel: "Whisper model",
  value: "whisper-base",
  options: [
    { value: "whisper-tiny", label: "Tiny", tag: "Fast" },
    { value: "whisper-base", label: "Base", tag: "Balanced" },
    { value: "whisper-small", label: "Small", tag: "Accurate" },
  ],
  onChange: () => resetEngine(),
});

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

    const barHeight = Math.max(2 * dpr, (0.14 + value * 0.86) * height * 0.76);
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
  if (busy) microphone.dataset.busy = "";
  else delete microphone.dataset.busy;
  microphone.setAttribute("aria-pressed", String(isRecording));
  microphone.setAttribute(
    "aria-label",
    isRecording ? "Stop dictation" : "Start dictation",
  );
  microphone.title = isRecording ? "Stop dictation" : "Start dictation";

  language.setDisabled(busy || isRecording);
  model.setDisabled(busy || isRecording);

  if (isRecording && previousStatus !== "recording") startVoiceAnimation();
  if (!isRecording && previousStatus === "recording") stopVoiceAnimation();
}

function createEngine(): SpeechToText {
  return createSpeechToText({
    language: language.getValue(),
    model: model.getValue() as DemoModel,
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

initSideRays({ spread: 3 });
initPromptComposerBorderGlow();
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
