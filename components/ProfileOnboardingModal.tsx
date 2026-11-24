import React, { useState } from 'react';
import { User } from '../types';
import { KENYA_COUNTIES } from '../constants/kenyaCounties';
import CustomSelect from './CustomSelect';
import { Sparkles, Building2, User as UserIcon, Phone, MapPin, Mail, ShieldCheck, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import { normalizeKenyanPhone, isValidKenyanPhone, formatKenyanPhoneDisplay } from '../utils/phoneUtils';
import { LEGACY_SCHOOL_PLACEHOLDERS, isProfileComplete } from '../utils/profileUtils';

interface ProfileOnboardingModalProps {
  currentUser: User;
  onProfileCompleted: (updatedUser: User) => void;
}

export const ProfileOnboardingModal: React.FC<ProfileOnboardingModalProps> = ({
  currentUser,
  onProfileCompleted,
}) => {
  // Infer initial first/last name if name exists
  const nameParts = (currentUser.name || '').trim().split(' ');
  const initialFirstName = currentUser.firstName || nameParts[0] || '';
  const initialLastName = currentUser.lastName || nameParts.slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber || '');
  const [schoolName, setSchoolName] = useState(
    currentUser.schoolName && !LEGACY_SCHOOL_PLACEHOLDERS.includes(currentUser.schoolName)
      ? currentUser.schoolName 
      : (currentUser.organization && !LEGACY_SCHOOL_PLACEHOLDERS.includes(currentUser.organization) ? currentUser.organization : '')
  );
  const [county, setCounty] = useState(currentUser.county || 'Nairobi City');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBrandNewAccount = !currentUser.firstLoginBonusGranted && (currentUser.credits === undefined || currentUser.credits === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validation
    if (!firstName.trim()) {
      setErrorMessage('First Name is required.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Last Name is required.');
      return;
    }

    if (!phoneNumber.trim()) {
      setErrorMessage('Phone Number is required.');
      return;
    }

    const normalizedPhone = normalizeKenyanPhone(phoneNumber);
    if (!normalizedPhone) {
      setErrorMessage('Invalid Kenyan phone number. Please enter a valid number (e.g. 0717 713 493 or +254717713493).');
      return;
    }

    if (!schoolName.trim()) {
      setErrorMessage('School Name is required.');
      return;
    }

    if (currentUser.role !== 'Admin' && LEGACY_SCHOOL_PLACEHOLDERS.includes(schoolName.trim())) {
      setErrorMessage('Please provide your actual school name. "Exameno ECG" and "Exameno School" are system placeholders.');
      return;
    }

    if (!county.trim()) {
      setErrorMessage('County selection is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const firebaseUser = auth.currentUser;
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : '';

      const response = await fetch('/api/user/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: normalizedPhone,
          schoolName: schoolName.trim(),
          county: county.trim(),
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete profile onboarding.');
      }

      // Success
      onProfileCompleted(data.user);
    } catch (err: any) {
      console.error('Profile Onboarding Error:', err);
      setErrorMessage(err.message || 'An error occurred while saving your profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto font-sans">
      <div className="bg-white border-2 border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 relative my-8 animate-scale-up">
        {/* Header Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                {isBrandNewAccount ? 'First-Time Teacher Onboarding' : 'Profile Update Required'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-none mt-1">
                {isBrandNewAccount ? 'Welcome to Exameno ECG!' : 'Complete Your Teacher Profile'}
              </h2>
            </div>
          </div>
          <p className="text-xs font-medium text-emerald-100 leading-relaxed mt-2">
            {isBrandNewAccount ? (
              <>Complete your teacher profile below to claim your <span className="font-bold underline text-white">5 FREE Generator Credits</span> and unlock full KICD-aligned curriculum generation tools.</>
            ) : (
              <>Please verify your official contact information and school affiliation to ensure full curriculum and assessment synchronization.</>
            )}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (Read-Only) */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Email Address (Account Identifier)</span>
            </label>
            <input
              type="email"
              disabled
              value={currentUser.email || ''}
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 cursor-not-allowed"
            />
          </div>

          {/* Name Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>First Name <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Last Name <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Kamau"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Phone Number <span className="text-rose-500">*</span></span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">e.g. 0717 713 493 or +254 717 713 493</span>
            </div>
            <input
              type="tel"
              required
              placeholder="07XXXXXXXX or +254XXXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
            {phoneNumber.trim() && (
              <div className="mt-1 text-[10px] font-mono flex items-center gap-1.5">
                <span className="text-slate-400">Canonical:</span>
                <span className={isValidKenyanPhone(phoneNumber) ? "text-emerald-700 font-bold" : "text-amber-600"}>
                  {normalizeKenyanPhone(phoneNumber) || 'Invalid Kenya format'}
                </span>
              </div>
            )}
          </div>

          {/* School Name */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>School Name <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Alliance High School or Moi Primary"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          {/* County Select */}
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

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{isBrandNewAccount ? 'Complete Profile & Claim 5 Free Credits' : 'Save Profile & Continue'}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>KICD & CBE Certified Educational Environment</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileOnboardingModal;
