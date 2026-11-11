import fs from "node:fs";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase key unavailable.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Auth failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2/orange-hotel-kitchen-state.json?auth=${encodeURIComponent(idToken)}`;
const response = await fetch(url, { headers: { Origin: "https://casa-cyan-psi.vercel.app", "X-Firebase-ETag": "true" } });
if (!response.ok) throw new Error(`Read failed: ${response.status}`);
const state = await response.json();
const payments = Array.isArray(state?.payments) ? state.payments : [];
const tickets = Array.isArray(state?.tickets) ? state.tickets : [];
console.log(JSON.stringify({ hasState: state !== null, payments: payments.length, tickets: tickets.length,
  menuItems: Array.isArray(state?.menuItems) ? state.menuItems.length : 0,
  etagReturned: Boolean(response.headers.get("etag")),
  browserHeaders: response.headers.get("access-control-expose-headers"),
  latestPaymentAt: payments.length ? new Date(Math.max(...payments.map((payment) => Number(payment.createdAt) || 0))).toISOString() : null }));

if (process.argv.includes("--probe")) {
  const probeUrl = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2/kitchen-sync-probe-${Date.now()}.json?auth=${encodeURIComponent(idToken)}`;
  try {
    const before = await fetch(probeUrl, { headers: { "X-Firebase-ETag": "true" } });
    if (!before.ok) throw new Error(`Probe read failed: ${before.status}`);
    const revision = before.headers.get("etag");
    if (!revision) throw new Error("Probe revision missing.");
    const saved = await fetch(probeUrl, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": revision }, body: JSON.stringify({ value: "ok" }) });
    if (!saved.ok) throw new Error(`Probe write failed: ${saved.status}`);
    const verified = await fetch(probeUrl);
    if (!verified.ok || (await verified.json())?.value !== "ok") throw new Error("Probe verification failed.");
    console.log("Kitchen HTTPS conditional write verified.");
  } finally {
    await fetch(probeUrl, { method: "DELETE" });
  }
}
