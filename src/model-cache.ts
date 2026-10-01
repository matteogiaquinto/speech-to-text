import type { ASRModel } from "browser-whisper";

import type { SpeechToTextCachePolicy } from "./types.js";

type BrowserWhisperModule = typeof import("browser-whisper");

type StoredResponseMetadata = {
  fileName?: string;
};

type DirectoryWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

const CACHE_REGISTRY_KEY = "@matteogiaquinto/speech-to-text:cache:v1";
const BROWSER_WHISPER_CACHE_ROOT = "browser-whisper-transformers-cache";
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

let maintenanceQueue: Promise<void> = Promise.resolve();

export function scheduleModelCacheMaintenance(
  browserWhisper: BrowserWhisperModule,
  model: ASRModel,
  policy: SpeechToTextCachePolicy,
): void {
  if (policy !== "single-model") return;

  maintenanceQueue = maintenanceQueue
    .then(() => maintainSingleModelCache(browserWhisper, model))
    .catch(() => undefined);
}

async function maintainSingleModelCache(
  browserWhisper: BrowserWhisperModule,
  model: ASRModel,
): Promise<void> {
  const registeredModel = readRegisteredModel();
  let modelCleanupSucceeded = true;

  if (registeredModel !== model) {
    for (const candidate of Object.keys(browserWhisper.MODELS) as ASRModel[]) {
      if (candidate === model) continue;
      try {
        await browserWhisper.BrowserWhisper.deleteModel(candidate);
      } catch {
        modelCleanupSucceeded = false;
      }
    }
  }

  await cleanupStaleOrphanedFiles().catch(() => undefined);

  if (modelCleanupSucceeded) writeRegisteredModel(model);
}

function readRegisteredModel(): ASRModel | undefined {
  try {
    if (!("localStorage" in globalThis)) return undefined;
    const raw = globalThis.localStorage.getItem(CACHE_REGISTRY_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as { model?: ASRModel; version?: number };
    if (parsed.version !== 1 || !parsed.model) return undefined;
    return parsed.model;
  } catch {
    return undefined;
  }
}

function writeRegisteredModel(model: ASRModel): void {
  try {
    if (!("localStorage" in globalThis)) return;
    globalThis.localStorage.setItem(
      CACHE_REGISTRY_KEY,
      JSON.stringify({ version: 1, model }),
    );
  } catch {
    // Storage metadata is an optimization; cleanup remains best-effort.
  }
}

async function cleanupStaleOrphanedFiles(): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.storage?.getDirectory !== "function"
  ) {
    return;
  }

  const originRoot = await navigator.storage.getDirectory();
  const cacheRoot = await getExistingDirectory(
    originRoot,
    BROWSER_WHISPER_CACHE_ROOT,
  );
  if (!cacheRoot) return;

  const files = await getExistingDirectory(cacheRoot, "files");
  const metadata = await getExistingDirectory(cacheRoot, "metadata");
  if (!files || !metadata) return;

  const referencedFiles = new Set<string>();

  for await (const [name, handle] of directoryEntries(metadata)) {
    if (handle.kind !== "file" || !name.endsWith(".json")) continue;

    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      const stored = JSON.parse(await file.text()) as StoredResponseMetadata;
      if (stored.fileName) referencedFiles.add(stored.fileName);
    } catch {
      // Incomplete metadata is ignored; recent files are protected below.
    }
  }

  const cutoff = Date.now() - ORPHAN_GRACE_MS;

  for await (const [name, handle] of directoryEntries(files)) {
    if (handle.kind !== "file" || referencedFiles.has(name)) continue;

    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      if (file.lastModified > cutoff) continue;
      await files.removeEntry(name);
    } catch {
      // Cache hygiene must never break transcription.
    }
  }
}

async function getExistingDirectory(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return undefined;
    }
    throw error;
  }
}

function directoryEntries(
  directory: FileSystemDirectoryHandle,
): AsyncIterableIterator<[string, FileSystemHandle]> {
  return (directory as DirectoryWithEntries).entries();
}
