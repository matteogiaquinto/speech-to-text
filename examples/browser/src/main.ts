import { createSpeechToText } from "@matteogiaquinto/speech-to-text";
import "./style.css";

const prepare = document.querySelector<HTMLButtonElement>("#prepare");
const start = document.querySelector<HTMLButtonElement>("#start");
const stop = document.querySelector<HTMLButtonElement>("#stop");
const status = document.querySelector<HTMLElement>("#status");
const transcript = document.querySelector<HTMLOutputElement>("#transcript");

if (!prepare || !start || !stop || !status || !transcript) {
  throw new Error("The demo page is missing required elements.");
}

const speech = createSpeechToText({
  language: "fr",
  model: "whisper-base",
  onStatus(nextStatus) {
    status.textContent = `État : ${nextStatus}`;
  },
});

prepare.addEventListener("click", async () => {
  prepare.disabled = true;
  transcript.textContent = "Téléchargement ou chargement du modèle…";
  try {
    await speech.prepare();
    transcript.textContent = "Modèle prêt. Vous pouvez parler.";
    start.disabled = false;
  } catch (error) {
    transcript.textContent =
      error instanceof Error
        ? error.message
        : "Le modèle n’a pas pu être préparé.";
    prepare.disabled = false;
  }
});

start.addEventListener("click", async () => {
  try {
    await speech.start();
    start.disabled = true;
    stop.disabled = false;
    transcript.textContent = "Enregistrement en cours…";
  } catch (error) {
    transcript.textContent =
      error instanceof Error
        ? error.message
        : "Le microphone n’a pas pu démarrer.";
  }
});

stop.addEventListener("click", async () => {
  stop.disabled = true;
  try {
    transcript.textContent = "Transcription locale…";
    transcript.textContent = (await speech.stop()) || "Aucune parole détectée.";
  } catch (error) {
    transcript.textContent =
      error instanceof Error ? error.message : "La transcription a échoué.";
  } finally {
    start.disabled = false;
  }
});

window.addEventListener("pagehide", () => speech.dispose());
