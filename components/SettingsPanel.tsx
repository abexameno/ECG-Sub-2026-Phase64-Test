import React, { useState } from 'react';
import { User, GeneratedContent } from '../types';
import { usePWA } from '../hooks/usePWA';
import { Cloud, CheckCircle2, Loader2, RefreshCw, AlertCircle, Calendar, ShieldCheck, User as UserIcon, Phone, Building2, MapPin, Share2 } from 'lucide-react';
import { KENYA_COUNTIES } from '../constants/kenyaCounties';
import CustomSelect from './CustomSelect';
import { normalizeKenyanPhone, isValidKenyanPhone, formatKenyanPhoneDisplay } from '../utils/phoneUtils';
import { LEGACY_SCHOOL_PLACEHOLDERS } from '../utils/profileUtils';
import { 
  getAccessToken, 
  setAccessToken, 
  connectToGoogleDrive, 
  backupAllToDrive 
} from '../services/googleDriveService';

interface SettingsPanelProps {
  currentUser: User;
  onUpdateUser: (user: User) => Promise<void>;
  onReferralsClick?: () => void;
  library?: GeneratedContent[];
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  currentUser, 
  onUpdateUser, 
  onReferralsClick,
  library = [] 
}) => {
  const { isInstallable, isInstalled, isIOS, showInstallPrompt } = usePWA();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [firstName, setFirstName] = useState(currentUser.firstName || currentUser.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '');
  const [phone, setPhone] = useState(currentUser.phoneNumber || '');
  const [schoolName, setSchoolName] = useState(currentUser.schoolName || currentUser.organization || '');
  const [county, setCounty] = useState(currentUser.county || 'Nairobi City');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(currentUser.googleDriveAutoSyncEnabled || false);

  // Google Drive Integration state
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState({ current: 0, total: 0 });
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim()) {
      setErrorMessage('First Name is required.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Last Name is required.');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }

    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) {
      setErrorMessage('Invalid Kenyan phone number format. Please enter a valid number such as 0717 713 493 or +254717713493.');
      return;
    }

    if (!schoolName.trim()) {
      setErrorMessage('School / Organization name is required.');
      return;
    }

    if (currentUser.role !== 'Admin' && LEGACY_SCHOOL_PLACEHOLDERS.includes(schoolName.trim())) {
      setErrorMessage('Please enter your actual school name. "Exameno School" and "Exameno ECG" are system placeholders.');
      return;
    }

    if (!county.trim()) {
      setErrorMessage('Please select your school county.');
      return;
    }

    setIsSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await onUpdateUser({
        ...currentUser,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName || currentUser.name,
        phoneNumber: normalizedPhone,
        schoolName: schoolName.trim(),
        organization: schoolName.trim(),
        county: county.trim(),
        profileComplete: true,
        googleDriveAutoSyncEnabled: isAutoSyncEnabled
      });
      setPhone(normalizedPhone);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (error: any) {
      console.error("Failed to update profile", error);
      setErrorMessage(error?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    try {
      setBackupError(null);
      const activeToken = await connectToGoogleDrive();
      setToken(activeToken);
      // Automatically save the auto-sync state as enabled once connected successfully
      if (!isAutoSyncEnabled) {
        setIsAutoSyncEnabled(true);
        await onUpdateUser({
          ...currentUser,
          googleDriveAutoSyncEnabled: true
        });
      }
    } catch (err: any) {
      if(window.self !== window.top) setBackupError('Please open the app in a new tab to connect to Google Drive. Popups are blocked in the preview window.'); else setBackupError('Failed to connect: ' + err.message);
      console.error(err);
    }
  };

  const handleDisconnect = () => {
    setAccessToken(null);
    setToken(null);
    setIsAutoSyncEnabled(false);
    onUpdateUser({
      ...currentUser,
      googleDriveAutoSyncEnabled: false
    });
  };

  const handleManualBackup = async () => {
    if (library.length === 0) return;
    
    let activeToken = token;
    setBackupError(null);
    setBackupSuccess(null);
    
    try {
      if (!activeToken) {
        activeToken = await connectToGoogleDrive();
        setToken(activeToken);
      }
      
      setIsBackingUp(true);
      const count = await backupAllToDrive(library, activeToken, (curr, tot) => {
        setBackupProgress({ current: curr, total: tot });
      });
      
      setBackupSuccess(`Successfully backed up ${count} of ${library.length} items to your 'Exameno' Google Drive folder!`);
    } catch (err: any) {
      if(window.self !== window.top && err.message?.includes('popup')) setBackupError('Please open the app in a new tab to connect to Google Drive.'); else setBackupError('Backup failed. Please check your internet connection and try again.');
      console.error(err);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const nextVal = !isAutoSyncEnabled;
    setBackupError(null);
    
    if (nextVal) {
      if (!token) {
        try {
          const activeToken = await connectToGoogleDrive();
          setToken(activeToken);
          setIsAutoSyncEnabled(true);
          await onUpdateUser({
            ...currentUser,
            googleDriveAutoSyncEnabled: true
          });
        } catch (err) {
          console.error("Failed to connect during auto-sync toggle:", err);
          if(window.self !== window.top) setBackupError('Please open the app in a new tab to connect to Google Drive. Popups are blocked in the preview window.'); else setBackupError('Google Drive connection is required to enable Auto-Sync.');
        }
      } else {
        setIsAutoSyncEnabled(true);
        await onUpdateUser({
          ...currentUser,
          googleDriveAutoSyncEnabled: true
        });
      }
    } else {
      setIsAutoSyncEnabled(false);
      await onUpdateUser({
        ...currentUser,
        googleDriveAutoSyncEnabled: false
      });
    }
  };

  const formattedDateJoined = currentUser.dateJoined 
    ? new Date(currentUser.dateJoined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : (currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Verified Member');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Teacher Profile & Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage your personal details and canonical school affiliation.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Member since: <strong className="text-slate-900">{formattedDateJoined}</strong></span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile successfully updated and synchronized!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">First Name *</label>
              <input 
                type="text" 
                required
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Last Name *</label>
              <input 
                type="text" 
                required
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm"
                placeholder="Enter your last name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={currentUser.email || ''} 
                readOnly
                disabled
                className="w-full p-3 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed font-medium text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1">Verified account Google identifier.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Kenyan Phone Number *</label>
              <input 
                type="tel" 
                required
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm"
                placeholder="e.g. 0717 713 493 or +254717713493"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Canonical storage: <code className="font-mono text-emerald-700">{formatKenyanPhoneDisplay(phone) || '+254XXXXXXXXX'}</code>
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">School / Organization *</label>
              <input 
                type="text" 
                required
                value={schoolName} 
                onChange={(e) => setSchoolName(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm"
                placeholder="Enter your actual school name"
              />
              {currentUser.role !== 'Admin' && (
                <p className="text-[10px] text-slate-400 mt-1">Teachers must specify their real school.</p>
              )}
            </div>
            <div>
              <CustomSelect
                label="County (Kenya) *"
                options={[...KENYA_COUNTIES]}
                value={county}
                onChange={(val) => setCounty(val)}
                searchable={true}
                variant="ecg"
                placeholder="Select your school county"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-4">
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Google Drive Backup Integration */}
      <div className="border-t border-slate-200 pt-8">
        <div className="flex items-center gap-3 mb-4">
          <Cloud className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Google Drive Backup</h2>
        </div>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Securely back up your generated CBE lesson plans, notes, and schemes of work to a dedicated <strong className="text-slate-900">"Exameno"</strong> folder in your Google Drive.
        </p>

        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-6">
          {/* Connection Status & Auto-Sync Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Connection Status: 
                {token ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    🟢 Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    ⚪ Not Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {token ? "Your Google session is active. Ready for backup." : "Authenticate with Google to grant permission."}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {token ? (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-2"
                >
                  <span className="font-sans font-bold text-emerald-600">G</span> Connect Drive
                </button>
              )}
            </div>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <h4 className="font-bold text-slate-800">Auto-Sync on Generation</h4>
              <p className="text-xs text-slate-500 mt-1">Automatically upload content as soon as it is saved to your library.</p>
            </div>
            <button
              onClick={handleToggleAutoSync}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${isAutoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${isAutoSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Manual Full Backup Action */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800">Full Library Backup</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Currently {library.length} items in your local content library.
                </p>
              </div>
              
              <button
                onClick={handleManualBackup}
                disabled={isBackingUp || library.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Backing up ({backupProgress.current}/{backupProgress.total})
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Run Backup Now
                  </>
                )}
              </button>
            </div>

            {/* Status Notifications */}
            {backupSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Backup Completed!</p>
                  <p className="mt-0.5">{backupSuccess}</p>
                </div>
              </div>
            )}

            {backupError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Error</p>
                  <p className="mt-0.5">{backupError}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {onReferralsClick && (
        <div className="border-t border-slate-200 pt-8">
          <h2 className="text-xl font-black text-slate-900 mb-4 uppercase tracking-widest">Referrals</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl gap-4">
            <div>
              <h4 className="font-bold text-emerald-950">Earn Extra Content Credits</h4>
              <p className="text-sm text-emerald-800">Invite fellow CBC/CBE teachers to Exameno ECG. When they sign up using your code, you both earn credits.</p>
            </div>
            <button
              onClick={onReferralsClick}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-widest transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
            >
              View Referrals
            </button>
          </div>
        </div>
      )}

      {!isInstalled && (
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-wider text-xs">Application Installation</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl gap-4">
            <div>
              <h4 className="font-bold text-blue-900">Install Exameno ECG</h4>
              <p className="text-sm text-blue-700">Install ECG on your device for quick access and supported offline features.</p>
            </div>
            {isInstallable ? (
              <button
                onClick={showInstallPrompt}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-widest transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                Install App
              </button>
            ) : isIOS ? (
              <button
                onClick={() => setShowIOSInstructions(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-widest transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                Install on iOS
              </button>
            ) : (
              <button
                onClick={() => alert("To install, look for the 'Add to Home Screen' option in your browser menu.")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-widest transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                Install Guide
              </button>
            )}
          </div>
        </div>
      )}

      {isInstalled && (
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-wider text-xs">Application Installation</h3>
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div>
              <h4 className="font-bold text-emerald-950">App Installed</h4>
              <p className="text-sm text-emerald-800">You are running the standalone Progressive Web App version of Exameno ECG.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300 uppercase tracking-widest">
              Active
            </span>
          </div>
        </div>
      )}

      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative">
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-900 mb-4">Install on iOS</h3>
              <p className="text-sm text-slate-600 mb-4">
                To install Exameno ECG on your iPhone or iPad:
              </p>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-3 font-medium">
                <li>Tap the <strong>Share</strong> button <span className="inline-block border border-slate-300 rounded px-1 ml-1 align-middle"><Share2 className="w-3 h-3 inline" /></span> in Safari's bottom menu bar.</li>
                <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> in the top right corner.</li>
              </ol>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl uppercase tracking-widest transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
