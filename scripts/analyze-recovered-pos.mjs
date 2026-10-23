import { readFile } from "node:fs/promises";

const [candidateFile, liveKitchenFile, liveBarFile] = process.argv.slice(2);
if (!candidateFile || !liveKitchenFile || !liveBarFile) {
  throw new Error("Usage: node scripts/analyze-recovered-pos.mjs <candidates> <live-kitchen> <live-bar>");
}

const candidates = JSON.parse(await readFile(candidateFile, "utf8"));
const live = {
  kitchen: JSON.parse(await readFile(liveKitchenFile, "utf8")),
  barista: JSON.parse(await readFile(liveBarFile, "utf8")),
};
const cutoff = Date.parse("2026-07-27T00:00:00+03:00");

function timestamp(record) {
  if (!record || typeof record !== "object") return null;
  for (const field of ["createdAt", "recordedAt", "updatedAt", "deliveredAt", "changedAt"]) {
    const numeric = Number(record[field]);
    if (Number.isFinite(numeric) && numeric > 100000000000) return numeric;
    const parsed = Date.parse(String(record[field] ?? ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function summarizeRecords(records, liveRecords) {
  const liveIds = new Set(liveRecords.map((record) => record?.id).filter(Boolean));
  const eligible = records.filter((record) => {
    const value = timestamp(record);
    return value === null || value >= cutoff;
  });
  const missing = eligible.filter((record) => record?.id && !liveIds.has(record.id));
  const dates = eligible.map(timestamp).filter(Number.isFinite).sort((a, b) => a - b);
  const missingDates = missing.map(timestamp).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    total: records.length,
    eligibleAfterCutoff: eligible.length,
    missingFromLive: missing.length,
    oldestEligible: dates.length ? new Date(dates[0]).toISOString() : null,
    newestEligible: dates.length ? new Date(dates.at(-1)).toISOString() : null,
    oldestMissing: missingDates.length ? new Date(missingDates[0]).toISOString() : null,
    newestMissing: missingDates.length ? new Date(missingDates.at(-1)).toISOString() : null,
    missingIds: missing.map((record) => record.id),
  };
}

const results = [];
for (const candidate of candidates) {
  if (!candidate.validJson || !candidate.key.endsWith("-state")) continue;
  const state = JSON.parse(candidate.value);
  const department = candidate.key.includes("kitchen-state") ? "kitchen" : "barista";
  results.push({
    filename: candidate.filename,
    key: candidate.key,
    department,
    ticketSeq: state.ticketSeq,
    tickets: summarizeRecords(Array.isArray(state.tickets) ? state.tickets : [], live[department].tickets ?? []),
    payments: summarizeRecords(Array.isArray(state.payments) ? state.payments : [], live[department].payments ?? []),
    ticketFields: Object.keys(state.tickets?.[0] ?? {}),
    paymentFields: Object.keys(state.payments?.[0] ?? {}),
  });
}

console.log(JSON.stringify(results, null, 2));
