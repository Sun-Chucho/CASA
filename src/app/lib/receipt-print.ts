import {
  DEFAULT_HARDWARE_SETTINGS,
  HardwareLane,
  HardwareSettings,
  STORAGE_HARDWARE_SETTINGS,
} from "@/app/lib/hardware-settings";
import { getUnifiedLocalKey } from "@/app/lib/firebase-sync";

interface ReceiptLine {
  name: string;
  qty: number;
}

interface ReceiptPayload {
  department: HardwareLane;
  code: string;
  destination: string;
  mode: string;
  method: string;
  status: string;
  total: number;
  createdAt: number;
  lines: ReceiptLine[];
}

interface PrintResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}

function padRight(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : `${value}${" ".repeat(width - value.length)}`;
}

function padLeft(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : `${" ".repeat(width - value.length)}${value}`;
}

function formatMoney(amount: number) {
  return `TSh ${amount.toLocaleString()}`;
}

function formatItemLine(line: ReceiptLine, width: number) {
  const qtyLabel = `${line.qty}x `;
  const nameWidth = Math.max(8, width - qtyLabel.length);
  return `${qtyLabel}${line.name.length > nameWidth ? `${line.name.slice(0, nameWidth - 1)}.` : line.name}`;
}

function buildReceiptContent(payload: ReceiptPayload, openDrawer: boolean) {
  const width = 42;
  const separator = "-".repeat(width);
  const lines: string[] = [];

  if (openDrawer) {
    lines.push("\u001bp\u0000\u0019\u00fa");
  }

  lines.push("CASSA HOTEL");
  lines.push(payload.department === "kitchen" ? "KITCHEN" : "BARISTA");
  lines.push(separator);
  lines.push(`Receipt: ${payload.code}`);
  lines.push(`Date: ${new Date(payload.createdAt).toLocaleString()}`);
  lines.push(`Service: ${payload.mode}`);
  lines.push(`Destination: ${payload.destination}`);
  lines.push(separator);

  for (const line of payload.lines) {
    lines.push(formatItemLine(line, width));
  }

  lines.push(separator);
  lines.push(`${padRight("Payment", 16)}${padLeft(payload.method.toUpperCase(), width - 16)}`);
  lines.push(`${padRight("Status", 16)}${padLeft(payload.status.toUpperCase(), width - 16)}`);
  lines.push(`${padRight("TOTAL", 16)}${padLeft(formatMoney(payload.total), width - 16)}`);
  lines.push(separator);
  lines.push("Thank you");
  lines.push("\n\n\n");

  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printWithBrowser(payload: ReceiptPayload): PrintResult {
  try {
    const content = buildReceiptContent(payload, false);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.srcdoc = `<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(payload.code)}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            html, body { margin: 0; padding: 0; background: #fff; color: #000; }
            pre { margin: 0; white-space: pre-wrap; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
          </style>
        </head>
        <body><pre>${escapeHtml(content)}</pre></body>
      </html>`;

    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        frame.remove();
        return;
      }
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Browser receipt printing failed.",
    };
  }
}

export async function listSystemPrinters() {
  if (typeof window === "undefined" || !window.orangeHotelHardware?.listPrinters) {
    return [];
  }

  try {
    return await window.orangeHotelHardware.listPrinters();
  } catch {
    return [];
  }
}

function readHardwareSettings(): HardwareSettings {
  if (typeof window === "undefined") return DEFAULT_HARDWARE_SETTINGS;

  const raw = localStorage.getItem(getUnifiedLocalKey(STORAGE_HARDWARE_SETTINGS));
  if (!raw) return DEFAULT_HARDWARE_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<HardwareSettings>;
    return {
      kitchen: { ...DEFAULT_HARDWARE_SETTINGS.kitchen, ...parsed.kitchen },
      barista: { ...DEFAULT_HARDWARE_SETTINGS.barista, ...parsed.barista },
    };
  } catch {
    return DEFAULT_HARDWARE_SETTINGS;
  }
}

export async function printDepartmentReceipt(payload: ReceiptPayload): Promise<PrintResult> {
  if (typeof window === "undefined") {
    return { ok: false, skipped: true, reason: "Printing only works in the POS client." };
  }

  const settings = readHardwareSettings()[payload.department];
  if (settings.autoPrintReceipt && settings.printerName.trim() && window.orangeHotelHardware?.printRaw) {
    try {
      const content = buildReceiptContent(payload, settings.openDrawerOnSale);
      const result = await window.orangeHotelHardware.printRaw({
        printerName: settings.printerName,
        content,
        openDrawer: settings.openDrawerOnSale,
      });

      if (result.ok) {
        return { ok: true };
      }
    } catch {
      // Fall through to the browser print dialog so a receipt is still delivered.
    }
  }

  return printWithBrowser(payload);
}
