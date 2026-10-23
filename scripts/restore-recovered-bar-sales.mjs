import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const candidateFile = process.argv[2];
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");
if (!candidateFile) {
  throw new Error("Usage: node scripts/restore-recovered-bar-sales.mjs <recovered-candidates.json> [--apply]");
}

const candidates = JSON.parse(await readFile(candidateFile, "utf8"));
const recoveredCandidate = candidates.find(
  (candidate) => candidate.key.includes("MAWIO_CURRENT") && candidate.key.endsWith("orange-hotel-barista-state"),
);
if (!recoveredCandidate) throw new Error("Recovered MAWIO bar state was not found.");
const recovered = JSON.parse(recoveredCandidate.value);

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAT55z0QVhfCtAAPvt0XZmZgEWGkLjaEsU";
const authResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  },
);
if (!authResponse.ok) throw new Error(`Firebase authentication failed (${authResponse.status}).`);
const { idToken } = await authResponse.json();
const databaseUrl = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2/orange-hotel-barista-state.json?auth=${encodeURIComponent(idToken)}`;

function mergeById(recoveredRecords, currentRecords) {
  const merged = new Map();
  for (const record of recoveredRecords) {
    if (record?.id !== undefined && record?.id !== null) merged.set(String(record.id), record);
  }
  for (const record of currentRecords) {
    if (record?.id !== undefined && record?.id !== null) merged.set(String(record.id), record);
  }
  return [...merged.values()].sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0));
}

const readResponse = await fetch(databaseUrl, { headers: { "X-Firebase-ETag": "true" } });
if (!readResponse.ok) throw new Error(`Firebase read failed (${readResponse.status}).`);
const etag = readResponse.headers.get("etag");
if (!etag) throw new Error("Firebase did not return an ETag; refusing a non-atomic recovery write.");
const current = await readResponse.json();

const currentTickets = Array.isArray(current?.tickets) ? current.tickets : [];
const currentPayments = Array.isArray(current?.payments) ? current.payments : [];
const recoveredTickets = Array.isArray(recovered?.tickets) ? recovered.tickets : [];
const recoveredPayments = Array.isArray(recovered?.payments) ? recovered.payments : [];
const next = {
  ...current,
  tickets: mergeById(recoveredTickets, currentTickets),
  payments: mergeById(recoveredPayments, currentPayments),
  menuItems: Array.isArray(current?.menuItems) ? current.menuItems : [],
  ticketSeq: Math.max(Number(current?.ticketSeq) || 0, Number(recovered?.ticketSeq) || 0),
};

const recoveredTicketIds = new Set(recoveredTickets.map((record) => String(record?.id)).filter(Boolean));
const recoveredPaymentIds = new Set(recoveredPayments.map((record) => String(record?.id)).filter(Boolean));
const undoState = {
  ...current,
  tickets: currentTickets.filter((record) => !recoveredTicketIds.has(String(record?.id))),
  payments: currentPayments.filter((record) => !recoveredPaymentIds.has(String(record?.id))),
};
const target = undo ? undoState : next;

const backupDirectory = path.resolve("recovery-backups");
await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDirectory, `${timestamp}-live-bar-before-local-recovery.json`);
await writeFile(backupFile, `${JSON.stringify(current, null, 2)}\n`, "utf8");

const result = {
  apply,
  undo,
  backupFile,
  before: { tickets: currentTickets.length, payments: currentPayments.length, ticketSeq: current?.ticketSeq },
  recovered: { tickets: recoveredTickets.length, payments: recoveredPayments.length, ticketSeq: recovered?.ticketSeq },
  after: { tickets: target.tickets.length, payments: target.payments.length, ticketSeq: target.ticketSeq },
};

if (apply || undo) {
  const writeResponse = await fetch(databaseUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "if-match": etag },
    body: JSON.stringify(target),
  });
  if (writeResponse.status === 412) {
    throw new Error("Firebase changed during recovery; no data was written. Run the recovery again to merge the new state.");
  }
  if (!writeResponse.ok) throw new Error(`Firebase recovery write failed (${writeResponse.status}).`);

  const verifyResponse = await fetch(databaseUrl);
  if (!verifyResponse.ok) throw new Error(`Firebase verification failed (${verifyResponse.status}).`);
  const verified = await verifyResponse.json();
  result.verified = {
    tickets: Array.isArray(verified?.tickets) ? verified.tickets.length : 0,
    payments: Array.isArray(verified?.payments) ? verified.payments.length : 0,
    ticketSeq: verified?.ticketSeq,
  };
}

console.log(JSON.stringify(result, null, 2));
