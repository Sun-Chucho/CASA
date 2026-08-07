import { adminFirestore } from '@/lib/firebaseAdmin';
// import admin from 'firebase-admin'; // removed unused import
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Ensure Firebase is initialized
  if (!adminFirestore) {
    return new Response(JSON.stringify({ ok: false, error: 'Firebase not initialized' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

    // Fetch data from critical collections
    const roomsSnap = await adminFirestore.collection('room_sales').get();
    const expensesSnap = await adminFirestore.collection('expenses').get();
    const barsSnap = await adminFirestore.collection('bar_sales').get();

    const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bars = barsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backupRef = await adminFirestore.collection('backups').add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      rooms,
      expenses,
      bars,
    });

    return new Response(JSON.stringify({ ok: true, backupId: backupRef.id }), {
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
