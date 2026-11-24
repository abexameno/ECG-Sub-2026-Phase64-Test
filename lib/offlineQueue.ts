import { openDB } from 'idb';

const DB_NAME = 'offline-queue';
const STORE_NAME = 'actions';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  },
});

export const addAction = async (action: any) => {
  const db = await dbPromise;
  await db.add(STORE_NAME, { ...action, timestamp: Date.now() });
  
  if ('serviceWorker' in navigator && 'sync' in (await navigator.serviceWorker.ready)) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register('sync-offline-actions');
    } catch (e) {
      console.error('Background sync registration failed', e);
    }
  }
};

export const getActions = async () => {
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
};

export const clearActions = async (ids: number[]) => {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(ids.map(id => tx.store.delete(id)));
  await tx.done;
};
