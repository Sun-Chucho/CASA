"use client";

import { useEffect, useMemo, useState } from "react";
import { BreakfastAllocation, BreakfastBooking, BREAKFAST_PRICE, STORAGE_BREAKFAST, bookingOccupiesDate, breakfastForBooking, breakfastId, localDateKey } from "@/app/lib/breakfast";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey, transactSyncedStorageValue } from "@/app/lib/firebase-sync";
import { readCashierState, readJson, STORAGE_CASHIER_STATE } from "@/app/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

export default function BreakfastPage() {
  const [date, setDate] = useState("");
  const [bookings, setBookings] = useState<BreakfastBooking[]>([]);
  const [allocations, setAllocations] = useState<BreakfastAllocation[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(localDateKey(Date.now()));
    const refresh = () => {
      setBookings(readCashierState<BreakfastBooking>("orange-hotel-cashier-transactions", "orange-hotel-cashier-seq", 84920).transactions);
      setAllocations(readJson<BreakfastAllocation[]>(STORAGE_BREAKFAST) ?? []);
    };
    refresh();
    void Promise.all([
      hydrateStorageKeyFromFirebase(STORAGE_CASHIER_STATE, true),
      hydrateStorageKeyFromFirebase(STORAGE_BREAKFAST, true),
    ]).finally(() => { refresh(); setReady(true); });
    const offBookings = subscribeToSyncedStorageKey(STORAGE_CASHIER_STATE, refresh);
    const offBreakfast = subscribeToSyncedStorageKey(STORAGE_BREAKFAST, refresh);
    return () => { offBookings(); offBreakfast(); };
  }, []);

  const occupied = useMemo(() => bookings.filter((booking) => bookingOccupiesDate(booking, date)).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })), [bookings, date]);
  const selected = useMemo(() => occupied.reduce((sum, booking) => sum + (allocations.find((entry) => entry.id === breakfastId(booking.id, date))?.count ?? 0), 0), [occupied, allocations, date]);

  async function changeCount(booking: BreakfastBooking, delta: number) {
    if (!ready || busy || date > localDateKey(Date.now()) || !bookingOccupiesDate(booking, date)) return;
    const id = breakfastId(booking.id, date);
    setBusy(id);
    setError("");
    try {
      await transactSyncedStorageValue<BreakfastAllocation[]>(STORAGE_BREAKFAST, (current) => {
        const records = Array.isArray(current) ? current : [];
        const previous = records.find((entry) => entry.id === id);
        const nextCount = (previous?.count ?? 0) + delta;
        const otherBreakfast = breakfastForBooking(booking.id, records) - (previous?.count ?? 0) * BREAKFAST_PRICE;
        if (nextCount < 0 || (nextCount * BREAKFAST_PRICE + otherBreakfast) > booking.total) return undefined;
        const remaining = records.filter((entry) => entry.id !== id);
        return [...remaining, { id, bookingId: booking.id, date, roomNumber: booking.roomNumber, guestName: booking.guestName || "Guest", count: nextCount, updatedAt: Date.now() }];
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save breakfast. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-black uppercase tracking-tight">Breakfast</h1><p className="text-sm text-muted-foreground">Tap a room once per breakfast guest. Each tap records TSh 5,000. Credit stays are counted when the booking is paid.</p></div>
      <label className="text-xs font-bold uppercase">Breakfast date<Input type="date" value={date} max={localDateKey(Date.now())} onChange={(event) => setDate(event.target.value)} className="mt-1 w-44" /></label>
    </header>
    <div className="flex flex-wrap gap-2 text-sm font-bold"><span>{occupied.length} occupied rooms</span><span>·</span><span>{selected} breakfasts</span><span>·</span><span>TSh {(selected * BREAKFAST_PRICE).toLocaleString()} allocated</span></div>
    {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
    {!ready && <p>Loading room stays and breakfast records…</p>}
    {ready && occupied.length === 0 && <p className="rounded-lg border p-5 text-sm text-muted-foreground">No occupied room stays are recorded for this date.</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      {ready && occupied.map((booking) => {
        const count = allocations.find((entry) => entry.id === breakfastId(booking.id, date))?.count ?? 0;
        const atLimit = breakfastForBooking(booking.id, allocations) + BREAKFAST_PRICE > booking.total;
        return <Card key={booking.id} className={count ? "border-amber-500 bg-amber-50" : ""}><CardContent className="space-y-1 p-3">
          <button type="button" disabled={Boolean(busy) || atLimit} onClick={() => changeCount(booking, 1)} className="w-full text-left disabled:opacity-60" aria-label={`Add breakfast for room ${booking.roomNumber}`}>
            <span className="block text-lg font-black">Room {booking.roomNumber}</span><span className="block truncate text-xs text-muted-foreground">{booking.guestName || "Guest"}</span>
            {booking.status === "credit" && <span className="block text-[10px] font-bold text-amber-700">Credit stay</span>}
            <span className="mt-2 block text-sm font-bold">{count} {count === 1 ? "guest" : "guests"}</span><span className="block text-xs font-semibold">TSh {(count * BREAKFAST_PRICE).toLocaleString()}</span>
          </button>
          <div className="flex gap-1 pt-1"><Button size="sm" variant="outline" className="h-7 flex-1" disabled={Boolean(busy) || count === 0} onClick={() => changeCount(booking, -1)} aria-label={`Remove breakfast for room ${booking.roomNumber}`}><Minus className="h-3 w-3" /></Button><Button size="sm" className="h-7 flex-1" disabled={Boolean(busy) || atLimit} onClick={() => changeCount(booking, 1)} aria-label={`Add breakfast for room ${booking.roomNumber}`}><Plus className="h-3 w-3" /></Button></div>
        </CardContent></Card>;
      })}
    </div>
  </div>;
}
