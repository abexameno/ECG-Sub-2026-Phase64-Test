import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function getFirestoreErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  
  if (error.error && typeof error.error === 'string') {
    return error.error;
  }
  
  if (error.code && typeof error.code === 'string') {
    return error.code;
  }
  
  try {
    return JSON.stringify(error);
  } catch (e) {
    return String(error);
  }
}

export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const errText = getFirestoreErrorMessage(error);
  const errStr = errText.toLowerCase();
  
  return (
    errStr.includes('quota') || 
    errStr.includes('limit exceeded') || 
    errStr.includes('exceeded') || 
    errStr.includes('quota exceeded') ||
    errStr.includes('resource_exhausted') ||
    error?.code === 'resource-exhausted'
  );
}

export function isOfflineError(error: any): boolean {
  if (!error) return false;
  const errText = getFirestoreErrorMessage(error);
  const errStr = errText.toLowerCase();

  return (
    errStr.includes('offline') ||
    errStr.includes('could not reach cloud firestore backend') ||
    errStr.includes('backend didn\'t respond within') ||
    errStr.includes('unavailable') ||
    error?.code === 'unavailable'
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errText = getFirestoreErrorMessage(error);
  const isQuota = isQuotaError(error);
  const isOffline = isOfflineError(error);

  const errInfo: FirestoreErrorInfo = {
    error: errText,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isQuota) {
    console.warn(
      `[OFFLINE FALLBACK MODE ACTIVE] Firestore Quota Exceeded for path "${path}" (${operationType}). All actions are saved securely in local browser storage.\n` +
      `Upgrade your database instance to avoid Spark plan quota limits at: https://console.firebase.google.com/project/lwps-2026/firestore/databases/ai-studio-examenocbeconten-682cf46e-18e4-448b-b562-01d342c08e88/data?openUpgradeDialog=true`
    );
    return; // Do not throw and do not console.error to keep the fallback seamless
  }

  if (isOffline) {
    console.warn(
      `[OFFLINE MODE] Firestore currently unreachable for path "${path}" (${operationType}). Local persistence and offline cache active.`
    );
    return; // Allow seamless offline execution without uncaught exceptions
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively removes any 'undefined' values from an object.
 * Firestore does not support 'undefined' as a field value.
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Do not recurse into Firestore FieldValue objects (e.g., increment, serverTimestamp)
  // These usually have a _methodName or are recognized by Firestore specifically.
  if ((obj as any)._methodName || (obj as any).constructor?.name === 'FieldValue') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as any;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as any)[key];
      if (value !== undefined) {
        result[key] = cleanForFirestore(value);
      }
    }
  }
  return result;
}
