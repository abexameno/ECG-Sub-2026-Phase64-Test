import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { SubscriptionTransaction } from '../types/subscription';
import {
  normalizeTransactionStatus,
  deduplicateAndSortTransactions,
  generateWhatsAppApprovalUrl,
  generateWhatsAppReceiptUrl,
  ADMIN_WHATSAPP_PHONE,
  ADMIN_MPESA_NUMBER
} from '../utils/transactionStatus';

const TRANSACTIONS_COLLECTION = 'transactions';

export const SubscriptionService = {
  ADMIN_WHATSAPP_PHONE,
  ADMIN_MPESA_NUMBER,
  generateWhatsAppApprovalUrl,
  generateWhatsAppReceiptUrl,

  async createTransaction(userId: string, amount: number, transactionNumber: string, packageId?: string): Promise<string> {
    const cleanNumber = transactionNumber.trim().toUpperCase();
    if (!cleanNumber || cleanNumber.length < 5) {
      throw new Error('Please enter a valid M-Pesa transaction number.');
    }

    // Attempt 1: Call authenticated backend endpoint which verifies globally
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const response = await fetch('/api/subscription/submit-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount,
            transactionNumber: cleanNumber,
            packageId: packageId || null
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transactionId) {
            return data.transactionId;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (errData.error && errData.error.includes('already been submitted')) {
            throw new Error(errData.error);
          }
          console.warn('Backend submit-transaction failed, falling back to client firestore:', errData);
        }
      }
    } catch (apiErr: any) {
      if (apiErr.message && apiErr.message.includes('already been submitted')) {
        throw apiErr;
      }
      console.warn('Direct API submission encountered error, trying Firestore client fallback:', apiErr.message);
    }

    // Attempt 2: Client Firestore fallback with rules-compliant query (MUST include userId)
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('userId', '==', userId),
        where('transactionNumber', '==', cleanNumber)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }

      const transactionData: Omit<SubscriptionTransaction, 'id'> = {
        userId,
        amount,
        transactionNumber: cleanNumber,
        status: 'PENDING_VERIFICATION',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);
      return docRef.id;
    } catch (firestoreErr: any) {
      console.error('Firestore client fallback failed:', firestoreErr);
      throw new Error(firestoreErr.message || 'Failed to submit transaction.');
    }
  },

  async getUserTransactions(userId: string): Promise<SubscriptionTransaction[]> {
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const rawList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          status: normalizeTransactionStatus(data.status),
        } as SubscriptionTransaction;
      });

      return deduplicateAndSortTransactions(rawList);
    } catch (e) {
      console.warn('Failed to fetch user transactions:', e);
      return [];
    }
  },

  subscribeToUserTransactions(
    userId: string,
    callback: (transactions: SubscriptionTransaction[]) => void
  ): () => void {
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('userId', '==', userId)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const rawList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              status: normalizeTransactionStatus(data.status),
            } as SubscriptionTransaction;
          });

          const normalizedAndDeduplicated = deduplicateAndSortTransactions(rawList);
          callback(normalizedAndDeduplicated);
        },
        (err) => {
          console.warn('Error in subscribeToUserTransactions listener:', err);
        }
      );
    } catch (err) {
      console.warn('Could not attach subscribeToUserTransactions listener:', err);
      return () => {};
    }
  }
};
