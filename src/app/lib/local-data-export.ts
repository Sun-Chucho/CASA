const CASA_EXPORT_FORMAT = "cassa-local-business-data";
const CASA_EXPORT_VERSION = 1;

const PRIVATE_KEY_FRAGMENTS = [
  "login-profiles",
  "manager-session-version",
  "password",
  "server-sync-etag",
] as const;

const PRIVATE_KEYS = new Set([
  "orange-hotel-role",
  "orange-hotel-username",
]);

type ExportSaveResult = "saved" | "downloaded" | "cancelled";

interface FileSystemWritableFileStreamLike {
  close(): Promise<void>;
  write(data: Blob): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike>;
}

export interface CasaLocalDataExport {
  format: typeof CASA_EXPORT_FORMAT;
  version: typeof CASA_EXPORT_VERSION;
  exportedAt: string;
  source: {
    origin: string;
    role: string;
    username: string;
    online: boolean;
  };
  summary: {
    dataKeyCount: number;
    pendingSyncCount: number;
  };
  data: Record<string, unknown>;
  pendingSync: Record<string, string>;
}

function isPrivateKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return PRIVATE_KEYS.has(normalizedKey) || PRIVATE_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));
}

function isPendingSyncKey(key: string) {
  return key.startsWith("orange-hotel-pending-sync:");
}

function isCasaBusinessDataKey(key: string) {
  if (isPrivateKey(key) || isPendingSyncKey(key)) return false;
  return key.startsWith("casa-v2:orange-hotel-") || key.startsWith("orange-hotel-");
}

function parseStoredValue(rawValue: string) {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

function sanitizeFilenamePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "user";
}

export function buildCasaLocalDataExport(storage: Storage): CasaLocalDataExport {
  const data: Record<string, unknown> = {};
  const pendingSync: Record<string, string> = {};

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;

    const rawValue = storage.getItem(key);
    if (rawValue === null) continue;

    if (isPendingSyncKey(key)) {
      pendingSync[key] = rawValue;
      continue;
    }

    if (isCasaBusinessDataKey(key)) {
      data[key] = parseStoredValue(rawValue);
    }
  }

  return {
    format: CASA_EXPORT_FORMAT,
    version: CASA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: {
      origin: window.location.origin,
      role: storage.getItem("orange-hotel-role") || "unknown",
      username: storage.getItem("orange-hotel-username") || "unknown",
      online: window.navigator.onLine,
    },
    summary: {
      dataKeyCount: Object.keys(data).length,
      pendingSyncCount: Object.keys(pendingSync).length,
    },
    data,
    pendingSync,
  };
}

export function getCasaExportFilename(payload: CasaLocalDataExport) {
  const timestamp = payload.exportedAt.replace(/[:.]/g, "-");
  return `CASSA-${sanitizeFilenamePart(payload.source.role)}-data-${timestamp}.json`;
}

export async function exportCasaLocalData(): Promise<ExportSaveResult> {
  const payload = buildCasaLocalDataExport(window.localStorage);
  const filename = getCasaExportFilename(payload);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const pickerWindow = window as SaveFilePickerWindow;

  if (typeof pickerWindow.showSaveFilePicker === "function") {
    try {
      const fileHandle = await pickerWindow.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "CASSA data backup",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // If the File System Access API is unavailable or blocked, use a normal
      // browser download so the local recovery copy is still created.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return "downloaded";
}
