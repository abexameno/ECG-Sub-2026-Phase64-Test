import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import rawConfig from './firebase-applet-config.json';

const firebaseConfig = rawConfig as {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId: string;
  firestoreDatabaseId?: string;
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

const targetDatabaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Robust Firestore initialization:
// 1. Enables experimentalAutoDetectLongPolling to prefer fast WebSockets while gracefully falling back to long-polling if blocked by a proxy.
// 2. Uses modern persistentLocalCache with persistentMultipleTabManager (or falls back to memoryLocalCache in restricted iframe/Node environments).
let dbInstance: Firestore;

const isBrowserWithIndexedDb = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

try {
  dbInstance = targetDatabaseId
    ? initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          ...(isBrowserWithIndexedDb
            ? {
                localCache: persistentLocalCache({
                  tabManager: persistentMultipleTabManager()
                })
              }
            : {
                localCache: memoryLocalCache()
              })
        },
        targetDatabaseId
      )
    : initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          ...(isBrowserWithIndexedDb
            ? {
                localCache: persistentLocalCache({
                  tabManager: persistentMultipleTabManager()
                })
              }
            : {
                localCache: memoryLocalCache()
              })
        }
      );
} catch (err) {
  console.warn('initializeFirestore with persistentLocalCache failed, falling back to memory cache / getFirestore:', err);
  try {
    dbInstance = targetDatabaseId
      ? initializeFirestore(
          app,
          {
            experimentalAutoDetectLongPolling: true,
            localCache: memoryLocalCache()
          },
          targetDatabaseId
        )
      : initializeFirestore(
          app,
          {
            experimentalAutoDetectLongPolling: true,
            localCache: memoryLocalCache()
          }
        );
  } catch {
    dbInstance = targetDatabaseId ? getFirestore(app, targetDatabaseId) : getFirestore(app);
  }
}

export const db = dbInstance;

// Initialize Auth
export const auth = getAuth(app);

// Test Firestore backend connection as required by firebase-integration skill guidelines
async function testConnection() {
  try {
    // Check against settings/global which is open for reading in firestore.rules
    await getDocFromServer(doc(db, 'settings', 'global'));
    console.log("Firestore connection check: Backend reachable and online.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.warn("Firestore connection check: Client is operating in offline mode. Local cache and offline fallbacks are active.");
    } else {
      console.debug("Firestore connection check:", error);
    }
  }
}

if (typeof window !== 'undefined') {
  // Run asynchronously without blocking initial render
  setTimeout(() => {
    testConnection();
  }, 200);
}

export default app;


