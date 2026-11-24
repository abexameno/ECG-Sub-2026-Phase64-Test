export interface CreditLog {
    id: string;
    date: string;
    action: string; // e.g., "Scheme of Work Generated", "Credits Purchased"
    creditsUsed: number; // Negative for usage, Positive for purchase
    balance: number;
}

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string; // Auto-generated
  password?: string; // Auto-generated (Mock purposes)
  phoneNumber?: string; 
  county?: string;
  profileComplete?: boolean;
  firstLoginBonusGranted?: boolean;
  role: 'Admin' | 'Teacher' | 'School Admin' | 'Student';
  status: 'Active' | 'Inactive';
  accountType?: 'Standard' | 'Demo'; 
  expiryDate?: string; 
  avatarColor: string;
  schoolId?: string;
  activeSchoolId?: string;
  schoolName?: string;
  organization?: string;
  dateJoined?: string;
  credits: number;
  creditLogs?: CreditLog[];
  createdAt?: string;
  lastUpdated?: string;
  autoClean?: boolean;
  googleDriveAutoSyncEnabled?: boolean;
  backupGoogleDriveAutoSyncEnabled?: boolean;
  hasSeenWelcomeGuide?: boolean;
  hasCompletedOnboarding?: boolean;
}

export interface SystemSettings {
    welcomeCredits: number;
    welcomeCreditsEnabled: boolean;
    creditCostSow: number;
    creditCostCba: number;
    creditCostLesson: number;
    creditCostQuiz: number;
    maintenanceMode: boolean;
    notificationMessage: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpSecure?: boolean;
    smtpFromEmail?: string;
    smtpFromName?: string;
    welcomeEmailSubject?: string;
    welcomeEmailBody?: string;
    updatedAt?: string;
}
