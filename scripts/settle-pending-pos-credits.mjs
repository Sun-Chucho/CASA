import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const apply = process.argv.includes("--apply");
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAT55z0QVhfCtAAPvt0XZmZgEWGkLjaEsU";
const databaseUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "https://casamotel-96c86-default-rtdb.firebaseio.com").replace(/\/+$/, "");
const keys = ["orange-hotel-kitchen-state", "orange-hotel-barista-state"];

const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ returnSecureToken: true }),
});
if (!authResponse.ok) throw new Error(`Firebase authentication failed (${authResponse.status}).`);
const { idToken } = await authResponse.json();
if (!idToken) throw new Error("Firebase authentication returned no token.");

for (const key of keys) {
  const url = `${databaseUrl}/casa-v2/${key}.json?auth=${encodeURIComponent(idToken)}`;
  const readResponse = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
  if (!readResponse.ok) throw new Error(`${key}: read failed (${readResponse.status}).`);
  const etag = readResponse.headers.get("etag");
  if (!etag) throw new Error(`${key}: no ETag returned; refusing an unprotected write.`);

  const current = await readResponse.json();
  if (!current || !Array.isArray(current.payments)) {
    throw new Error(`${key}: canonical POS snapshot or payments array is missing.`);
  }

  const pending = current.payments.filter((payment) => payment?.status === "credit");
  console.log(`${key}: ${pending.length} pending credit payment(s) of ${current.payments.length} total.`);
  if (!apply || pending.length === 0) continue;

  const backupDirectory = path.resolve("recovery-backups");
  await mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `${timestamp}-${key}-before-cash-settlement.json`);
  await writeFile(backupPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");

  const editedAt = Date.now();
  const next = {
    ...current,
    payments: current.payments.map((payment) => payment?.status === "credit"
      ? { ...payment, status: "completed", method: "cash", paymentMethodEditedAt: editedAt, updatedAt: editedAt }
      : payment),
  };
  const writeResponse = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "If-Match": etag },
    body: JSON.stringify(next),
  });
  if (!writeResponse.ok) throw new Error(`${key}: conditional write failed (${writeResponse.status}); backup: ${backupPath}`);

  const verifyResponse = await fetch(url);
  if (!verifyResponse.ok) throw new Error(`${key}: verification read failed (${verifyResponse.status}); backup: ${backupPath}`);
  const verified = await verifyResponse.json();
  const remaining = Array.isArray(verified?.payments)
    ? verified.payments.filter((payment) => payment?.status === "credit").length
    : null;
  if (remaining !== 0) throw new Error(`${key}: verification found ${remaining} remaining credits; backup: ${backupPath}`);
  console.log(`${key}: settled ${pending.length} as cash; verified zero pending credits. Backup: ${backupPath}`);
}
