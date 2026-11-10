"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BreakfastAllocation, BreakfastBooking, BreakfastSaleLine, BREAKFAST_PRICE,
  STORAGE_BREAKFAST, applyBreakfastSale, bookingOccupiesDate, breakfastForBooking,
  breakfastId, localDateKey,
} from "@/app/lib/breakfast";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey, transactSyncedStorageValue } from "@/app/lib/firebase-sync";
import { readCashierState, readJson, STORAGE_CASHIER_STATE } from "@/app/lib/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, ReceiptText } from "lucide-react";

export default function BreakfastPage() {
  const [date, setDate] = useState("");
  const [bookings, setBookings] = useState<BreakfastBooking[]>([]);
  const [allocations, setAllocations] = useState<BreakfastAllocation[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [lastCheque, setLastCheque] = useState<{ date: string; lines: BreakfastSaleLine[]; soldAt: number } | null>(null);

  useEffect(() => {
    setDate(localDateKey(Date.now()));
    const refresh = () => {
      setBookings(readCashierState<BreakfastBooking>("orange-hotel-cashier-transactions", "orange-hotel-cashier-seq", 0).transactions);
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

  const occupied = useMemo(() => {
    const eligible = bookings.filter((booking) => bookingOccupiesDate(booking, date));
    // A room can check out and check in again on one date. Breakfast belongs
    // to the guest who stayed the preceding night, so show that booking once.
    eligible.sort((a, b) => (a.checkInDate || "").localeCompare(b.checkInDate || "") || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const byRoom = new Map<string, BreakfastBooking>();
    eligible.forEach((booking) => { if (!byRoom.has(booking.roomNumber)) byRoom.set(booking.roomNumber, booking); });
    return [...byRoom.values()]
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  }, [bookings, date]);
  const selected = useMemo(() => occupied.reduce((sum, booking) =>
    sum + (allocations.find((entry) => entry.id === breakfastId(booking.id, date))?.count ?? 0), 0), [occupied, allocations, date]);
  const chequeLines = useMemo<BreakfastSaleLine[]>(() => occupied.flatMap((booking) =>
    cart[booking.id] > 0 ? [{ booking, quantity: cart[booking.id] }] : []), [occupied, cart]);
  const chequeQuantity = chequeLines.reduce((sum, line) => sum + line.quantity, 0);
  const chequeTotal = chequeQuantity * BREAKFAST_PRICE;

  function changeCart(booking: BreakfastBooking, delta: number) {
    if (!ready || busy || !bookingOccupiesDate(booking, date)) return;
    setError("");
    setCart((current) => {
      const quantity = Math.max(0, (current[booking.id] ?? 0) + delta);
      if (breakfastForBooking(booking.id, allocations) + quantity * BREAKFAST_PRICE > booking.total) return current;
      const next = { ...current };
      if (quantity) next[booking.id] = quantity;
      else delete next[booking.id];
      return next;
    });
  }

  async function removeSavedBreakfast(booking: BreakfastBooking) {
    if (!ready || busy || !bookingOccupiesDate(booking, date)) return;
    const id = breakfastId(booking.id, date);
    setBusy(id);
    setError("");
    try {
      await transactSyncedStorageValue<BreakfastAllocation[]>(STORAGE_BREAKFAST, (current) => {
        const records = Array.isArray(current) ? current : [];
        const previous = records.find((entry) => entry.id === id);
        if (!previous || previous.count < 1) return undefined;
        return [...records.filter((entry) => entry.id !== id), { ...previous, count: previous.count - 1, updatedAt: Date.now() }];
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not correct breakfast. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function recordSale() {
    if (!ready || busy || chequeQuantity === 0) return;
    if (chequeLines.length !== Object.keys(cart).length || chequeLines.some((line) => !bookingOccupiesDate(line.booking, date))) {
      setError("A room on the cheque is no longer occupied. Clear it and try again.");
      return;
    }
    const soldAt = Date.now();
    const saleDate = date;
    const saleLines = chequeLines;
    setBusy("sale");
    setError("");
    try {
      await transactSyncedStorageValue<BreakfastAllocation[]>(STORAGE_BREAKFAST, (current) =>
        applyBreakfastSale(Array.isArray(current) ? current : [], saleLines, saleDate, soldAt),
      );
      setLastCheque({ date: saleDate, lines: saleLines, soldAt });
      setCart({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record sale. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Breakfast</h1>
        <p className="text-sm text-muted-foreground">Tap rooms to build a cheque, then press Sale to record breakfast. Credit stays count when the booking is paid.</p>
      </div>
      <label className="text-xs font-bold uppercase">Breakfast date
        <Input type="date" value={date} max={localDateKey(Date.now())} disabled={Boolean(busy)}
          onChange={(event) => { setDate(event.target.value); setCart({}); setLastCheque(null); setError(""); }} className="mt-1 w-44" />
      </label>
    </header>
    <div className="flex flex-wrap gap-2 text-sm font-bold">
      <span>{occupied.length} occupied rooms</span><span>·</span><span>{selected} breakfasts sold</span><span>·</span>
      <span>TSh {(selected * BREAKFAST_PRICE).toLocaleString()} recorded</span>
    </div>
    {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
    {!ready && <p>Loading room stays and breakfast records…</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {ready && occupied.length === 0 && <p className="rounded-lg border p-5 text-sm text-muted-foreground">No occupied room stays are recorded for this date.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {ready && occupied.map((booking) => {
            const sold = allocations.find((entry) => entry.id === breakfastId(booking.id, date))?.count ?? 0;
            const inCart = cart[booking.id] ?? 0;
            const atLimit = breakfastForBooking(booking.id, allocations) + (inCart + 1) * BREAKFAST_PRICE > booking.total;
            return <Card key={booking.id} className={sold || inCart ? "border-amber-500 bg-amber-50" : ""}><CardContent className="space-y-1 p-3">
              <button type="button" disabled={Boolean(busy) || atLimit} onClick={() => changeCart(booking, 1)}
                className="w-full text-left disabled:opacity-60" aria-label={`Add room ${booking.roomNumber} to breakfast cheque`}>
                <span className="block text-lg font-black">Room {booking.roomNumber}</span>
                <span className="block truncate text-xs text-muted-foreground">{booking.guestName || "Guest"}</span>
                {booking.status === "credit" && <span className="block text-[10px] font-bold text-amber-700">Credit stay</span>}
                <span className="mt-2 block text-xs font-bold">Sold: {sold} · In cart: {inCart}</span>
                <span className="block text-xs font-semibold">Cheque: TSh {(inCart * BREAKFAST_PRICE).toLocaleString()}</span>
              </button>
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="outline" className="h-7 flex-1" disabled={Boolean(busy) || inCart === 0}
                  onClick={() => changeCart(booking, -1)} aria-label={`Remove room ${booking.roomNumber} from breakfast cheque`}><Minus className="h-3 w-3" /></Button>
                <Button size="sm" className="h-7 flex-1" disabled={Boolean(busy) || atLimit}
                  onClick={() => changeCart(booking, 1)} aria-label={`Add room ${booking.roomNumber} to breakfast cheque`}><Plus className="h-3 w-3" /></Button>
              </div>
              {sold > 0 && <Button type="button" size="sm" variant="ghost" className="h-7 w-full text-[10px]" disabled={Boolean(busy)}
                onClick={() => removeSavedBreakfast(booking)}>Correct saved −1</Button>}
            </CardContent></Card>;
          })}
        </div>
      </div>
      <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="h-5 w-5" />Breakfast Cart / Cheque</CardTitle>
          <CardDescription>{date || "Select a date"} · TSh {BREAKFAST_PRICE.toLocaleString()} per guest</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {chequeLines.length === 0 ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Tap a room to add breakfast to this cheque.</p> :
              <div className="max-h-72 space-y-2 overflow-auto">{chequeLines.map(({ booking, quantity }) =>
                <div key={booking.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm">
                  <div><p className="font-bold">Room {booking.roomNumber}</p><p className="text-xs text-muted-foreground">{quantity} × TSh {BREAKFAST_PRICE.toLocaleString()}{booking.status === "credit" ? " · credit" : ""}</p></div>
                  <p className="font-bold">TSh {(quantity * BREAKFAST_PRICE).toLocaleString()}</p>
                </div>)}</div>}
            <div className="flex justify-between border-t pt-3 text-sm font-black"><span>{chequeQuantity} {chequeQuantity === 1 ? "Breakfast" : "Breakfasts"}</span><span>TSh {chequeTotal.toLocaleString()}</span></div>
            <Button className="w-full font-black uppercase" disabled={!ready || Boolean(busy) || chequeQuantity === 0} onClick={recordSale}>{busy === "sale" ? "Recording…" : "Sale"}</Button>
            <Button className="w-full" variant="outline" disabled={Boolean(busy) || chequeQuantity === 0} onClick={() => setCart({})}>Clear cheque</Button>
          </CardContent></Card>
        {lastCheque && <Card className="border-green-500"><CardHeader className="pb-2"><CardTitle className="text-base text-green-700">Sale recorded</CardTitle>
          <CardDescription>{lastCheque.date} · {new Date(lastCheque.soldAt).toLocaleTimeString()}</CardDescription></CardHeader>
          <CardContent className="space-y-1 text-sm">{lastCheque.lines.map(({ booking, quantity }) => <p key={booking.id}>Room {booking.roomNumber}: {quantity} × TSh {BREAKFAST_PRICE.toLocaleString()}</p>)}
            <p className="border-t pt-2 font-black">Total TSh {(lastCheque.lines.reduce((sum, line) => sum + line.quantity, 0) * BREAKFAST_PRICE).toLocaleString()}</p>
          </CardContent></Card>}
      </div>
    </div>
  </div>;
}
