import { adminFirestore } from '@/lib/firebaseAdmin';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch data from critical collections
    const roomsSnap = await getDocs(collection(adminFirestore, 'room_sales'));
    const expensesSnap = await getDocs(collection(adminFirestore, 'expenses'));
    const barsSnap = await getDocs(collection(adminFirestore, 'bar_sales'));

    const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bars = barsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backupDoc = doc(collection(adminFirestore, 'backups'));
    await setDoc(backupDoc, {
      createdAt: serverTimestamp(),
      rooms,
      expenses,
      bars,
    });

    return new Response(JSON.stringify({ ok: true, backupId: backupDoc.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backup failed', error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
