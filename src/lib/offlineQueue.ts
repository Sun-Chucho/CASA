import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { adminFirestore } from '@/lib/firebaseAdmin';
import { collection, setDoc, doc } from 'firebase-admin/firestore';

interface OfflineWrite {
  collection: string;
  data: any;
  id?: string;
}

interface MyDB extends DBSchema {
  'offline-writes': {
    key: number;
    value: OfflineWrite;
  };
}

let dbPromise: Promise<IDBPDatabase<MyDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MyDB>('offline-writes-db', 1, {
      upgrade(db) {
        db.createObjectStore('offline-writes', { autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export async function enqueueWrite(collectionName: string, data: any, id?: string) {
  const db = await getDb();
  await db.add('offline-writes', { collection: collectionName, data, id });
}

export async function processQueue() {
  const db = await getDb();
  const tx = db.transaction('offline-writes', 'readwrite');
  const store = tx.objectStore('offline-writes');
  let cursor = await store.openCursor();
  while (cursor) {
    const { collection: coll, data, id } = cursor.value;
    try {
      const docRef = id ? doc(collection(adminFirestore, coll), id) : doc(collection(adminFirestore, coll));
      await setDoc(docRef, data);
      await cursor.delete();
    } catch (e) {
      console.error('Failed to sync offline write', e);
      // keep the entry for next retry
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue().catch(console.error);
  });
}
