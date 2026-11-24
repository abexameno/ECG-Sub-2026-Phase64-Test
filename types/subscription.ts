export type TransactionCanonicalStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

export interface SubscriptionTransaction {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  phone?: string;
  phoneNumber?: string;
  amount: number;
  transactionNumber: string;
  status: TransactionCanonicalStatus;
  packageId?: string;
  schoolId?: string;
  manuallyProcessed?: boolean;
  processedBy?: string;
  createdAt: any; // Using any for Firestore timestamp type
  updatedAt: any;
}
