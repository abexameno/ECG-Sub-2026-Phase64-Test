import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, QueryConstraint, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType, cleanForFirestore } from '../firebaseUtils';

export async function getDocument(path: string, id: string) {
  try {
    const docRef = doc(db, path, id);
    return await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
  }
}

export async function setDocument(path: string, id: string, data: any) {
  try {
    const docRef = doc(db, path, id);
    const cleanedData = cleanForFirestore(data);
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${id}`);
  }
}

export async function setDocumentWithMetadata(path: string, id: string, data: any) {
  try {
    const docRef = doc(db, path, id);
    const cleanedData = cleanForFirestore({...data, lastUpdated: serverTimestamp()});
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${id}`);
  }
}

export async function fetchCollection(path: string, constraints: QueryConstraint[] = []) {
  try {
    const colRef = collection(db, path);
    const q = query(colRef, ...constraints);
    return await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function removeDocument(path: string, id: string) {
  try {
    const docRef = doc(db, path, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
  }
}
