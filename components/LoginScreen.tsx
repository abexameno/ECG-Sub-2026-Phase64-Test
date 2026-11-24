
import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthoritativeAccountService } from '../services/authoritativeAccountService.ts';
import { BookOpen, NotebookText, FileText, CheckSquare, Users, Award, Zap, Clock, Mail, Lock, User as UserIcon } from 'lucide-react';
import { ExamenoLogo } from './ExamenoLogo';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

async function initializeUserAccountFromServer(
  firebaseUser: FirebaseUser,
  options: { name?: string; phoneNumber?: string; inviterId?: string | null }
): Promise<Partial<User>> {
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch('/api/user/complete-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      initializeOnly: true,
      name: options.name || firebaseUser.displayName || 'Teacher',
      phoneNumber: options.phoneNumber || '',
      inviterId: options.inviterId || undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to initialize user account on server.');
  }

  if (payload?.user) {
    return payload.user;
  }

  return AuthoritativeAccountService.buildSafeUninitializedUserFallback({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: options.name || firebaseUser.displayName,
  });
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [welcomeCredits, setWelcomeCredits] = useState(5);
  const [isWelcomeEnabled, setIsWelcomeEnabled] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          const welcomeCreditsVal = settingsSnap.data().welcomeCredits ?? 5;
          const welcomeCreditsEnabledVal = settingsSnap.data().welcomeCreditsEnabled ?? true;
          setWelcomeCredits(welcomeCreditsVal);
          setIsWelcomeEnabled(welcomeCreditsEnabledVal);
          try {
            localStorage.setItem(
              'exameno_login_settings',
              JSON.stringify({ welcomeCredits: welcomeCreditsVal, welcomeCreditsEnabled: welcomeCreditsEnabledVal })
            );
          } catch {}
        }
      } catch (e: any) {
        console.warn('Error fetching settings for login screen (using local defaults):', e.message);
        try {
          const saved = localStorage.getItem('exameno_login_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            setWelcomeCredits(parsed.welcomeCredits ?? 5);
            setIsWelcomeEnabled(parsed.welcomeCreditsEnabled ?? true);
          }
        } catch {}
      }
    };
    fetchSettings();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      let userDocExists = false;
      let userData: any = null;

      try {
        const userDoc = await getDoc(userDocRef);
        userDocExists = userDoc.exists();
        if (userDocExists) {
          userData = userDoc.data();
        }
      } catch (err: any) {
        console.warn('Firestore read warning during Google login:', err.message);
      }

      if (!userDocExists || !userData) {
        const params = new URLSearchParams(window.location.search);
        const inviterId = params.get('ref');
        try {
          userData = await initializeUserAccountFromServer(user, {
            name: user.displayName || 'Teacher',
            inviterId,
          });
        } catch (initErr: any) {
          console.warn('Server account initialization warning during Google login:', initErr.message);
          userData = AuthoritativeAccountService.buildSafeUninitializedUserFallback({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          });
        }
      }

      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } else {
        if (!name || !email || !password) {
          setError('Name, email and password are required.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const params = new URLSearchParams(window.location.search);
        const inviterId = params.get('ref');

        const initializedUser = await initializeUserAccountFromServer(user, {
          name,
          phoneNumber: phone,
          inviterId,
        });

        try {
          fetch('/api/notifications/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: initializedUser.email || email, name: initializedUser.name || name }),
          }).catch((e) => console.error('Welcome email fire-and-forget failed:', e));

          fetch('/api/notifications/new-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: initializedUser.email || email,
              name: initializedUser.name || name,
              role: initializedUser.role || 'Teacher',
            }),
          }).catch((e) => console.error('Admin signup notification fire-and-forget failed:', e));
        } catch (e) {
          console.error('Welcome email triggering error:', e);
        }

        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
 
 if (isLoading) {
 return (
 <div className="min-h-screen bg-slate-50 flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
 <p className="mt-4 text-emerald-600 font-medium tracking-widest uppercase opacity-80">Authenticating...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-slate-50 pb-12">
 {/* Hero Section */}
 <div className="bg-[#059669] text-white py-24 px-4 flex items-center justify-center">
 <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
 <div className="bg-white p-8 rounded-full mb-8 ">
 <ExamenoLogo className="h-20 w-20" />
 </div>
 <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight">Exameno CBC Content Generator (ECG)</h1>
 <p className="text-2xl sm:text-3xl font-bold mb-3">Create CBC & CBE Content. Teach Smarter. Assess Better.</p>
 <p className="text-lg font-medium opacity-90">AI-powered platform for Teachers, Tutors & Schools.</p>
 </div>
 </div>

 <div className="max-w-4xl mx-auto px-4 -mt-16">
 {/* Success Banner */}
 {isWelcomeEnabled && welcomeCredits > 0 && (
 <div className="bg-white text-emerald-800 p-4 rounded-2xl text-center font-bold mb-8 border border-emerald-200">
 🎉 Get {welcomeCredits} FREE credits when you create your account!
 </div>
 )}

 {/* Feature Icons */}
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
 {[
 { icon: BookOpen, label: 'Schemes of Work (SOW)' },
 { icon: NotebookText, label: 'Lesson Plans & Notes' },
 { icon: FileText, label: 'Record of Work Covered (ROWC)' },
 { icon: CheckSquare, label: 'Exams & Assessment Questions' },
 { icon: Users, label: 'Integrated Student LMS' },
 ].map((feature, i) => (
 <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
 <feature.icon className="h-10 w-10 text-emerald-600 mb-3" />
 <span className="text-xs font-bold text-slate-800">{feature.label}</span>
 </div>
 ))}
 </div>

 {/* Info Card */}
 <div className="bg-white p-8 rounded-2xl border border-slate-200 mb-8 text-center ">
 <h2 className="text-2xl font-black text-slate-900 mb-3">For Teachers, Tutors & Schools</h2>
 <p className="text-slate-600 text-lg">Create curriculum-aligned content, manage teaching, deliver assessments, and support student learning—all from one integrated platform.</p>
 </div>

 {/* Auth Card */}
 <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 overflow-hidden">
 <div className="p-8">
 <form onSubmit={handleSubmit} className="space-y-5">
 {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}
 {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">{message}</div>}
 
 {!isLogin && (
 <>
 <div className="relative">
 <UserIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
 <input type="text" placeholder="Full Name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white" />
 </div>
 <div className="relative">
 <UserIcon className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
 <input type="tel" placeholder="Phone Number (Optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white" />
 </div>
 </>
 )}
 <div className="relative">
 <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
 <input type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white" />
 </div>
 <div className="relative">
 <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
 <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white" />
 </div>
 {isLogin && <button type="button" onClick={handleResetPassword} className="text-sm text-emerald-600 font-bold hover:underline">Forgot password?</button>}
 <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all ">
 {isLoading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
 </button>
 </form>

 <div className="mt-8">
 <div className="relative flex items-center justify-center text-sm mb-4">
 <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
 </div>
 <button onClick={handleGoogleLogin} className="w-full py-4 border border-slate-200 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-bold">
 <img className="h-6 w-6" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
 Continue with Google
 </button>
 </div>

 <div className="mt-8 text-center">
 <button onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="text-sm text-emerald-600 font-bold hover:underline">
 {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
 </button>
 </div>
 </div>
 </div>
 
 {/* Footer */}
 <div className="mt-16 grid grid-cols-3 gap-6 text-center">
 {[
 { icon: Award, label: 'KICD-Aligned' },
 { icon: Zap, label: 'AI-Powered' },
 { icon: Clock, label: 'Save Time & Effort' },
 ].map((item, i) => (
 <div key={i} className="flex flex-col items-center">
 <item.icon className="h-8 w-8 text-slate-400 mb-3" />
 <span className="text-sm font-bold text-slate-600">{item.label}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};

export default LoginScreen;

