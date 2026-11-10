// Release stale occupied room flags only while there are no bookings.
// Run with --apply; uses an ETag so a concurrent new booking aborts the reset.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase API key was not found.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Firebase authentication failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const read = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!read.ok) throw new Error(`Firebase read failed: ${read.status}`);
const etag = read.headers.get("etag");
if (!etag) throw new Error("Firebase did not return an ETag.");
const original = await read.json();
if ((original?.["orange-hotel-cashier-state"]?.transactions ?? []).length !== 0) throw new Error("Bookings exist; room occupancy cannot be cleared automatically.");
const rooms = original?.["orange-hotel-rooms-state"];
if (!Array.isArray(rooms)) throw new Error("Room records are missing.");
const occupied = rooms.filter((room) => room.status === "occupied");
console.log(`${occupied.length} occupied room flags with zero bookings.`);
if (!process.argv.includes("--apply") || occupied.length === 0) process.exit(0);
const backup = path.join(os.homedir(), "Downloads", `CASSA-before-room-reconciliation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const next = { ...original, "orange-hotel-rooms-state": rooms.map((room) => room.status === "occupied" ? { ...room, status: "available" } : room) };
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Room reconciliation failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if (saved["orange-hotel-rooms-state"]?.some((room) => room.status === "occupied")) throw new Error(`Room verification failed. Backup: ${backup}`);
console.log(`Rooms released and verified. Backup: ${backup}`);
