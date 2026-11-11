import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const key = "orange-hotel-laundry-records";
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase key unavailable.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Auth failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const response = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!response.ok) throw new Error(`Read failed: ${response.status}`);
const etag = response.headers.get("etag");
if (!etag) throw new Error("Firebase did not provide an ETag.");
const root = await response.json();
const records = root[key] ?? [];
if (!Array.isArray(records)) throw new Error("Laundry records have an unexpected shape.");
console.log(JSON.stringify({ recordCount: records.length,
  completedCount: records.filter((record) => record.status === "completed").length,
  completedTotal: records.filter((record) => record.status === "completed").reduce((sum, record) => sum + (record.totalAmount ?? 0), 0),
  creditCount: records.filter((record) => record.status === "credit").length,
  creditTotal: records.filter((record) => record.status === "credit").reduce((sum, record) => sum + (record.totalAmount ?? 0), 0) }));
if (!process.argv.includes("--apply")) {
  console.log("Dry run only. Pass --apply to commit the guarded reset.");
  process.exit(0);
}
const backupPath = path.join(os.homedir(), "Downloads", `casa-laundry-before-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(root));
root[key] = null;
const write = await fetch(url, {
  method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(root),
});
if (!write.ok) throw new Error(`Guarded write failed: ${write.status}. No reset applied. Backup: ${backupPath}`);
const verify = await fetch(url);
if (!verify.ok) throw new Error(`Verification read failed: ${verify.status}`);
const current = await verify.json();
if ((current[key] ?? []).length !== 0) throw new Error("Laundry records reappeared during verification.");
console.log(`Verified: zero laundry records. Backup: ${backupPath}`);
