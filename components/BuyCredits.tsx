import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, ArrowLeft, Send, Copy, Check, Clock, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { User } from '../types.ts';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SubscriptionService } from '../services/subscriptionService';

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  popular?: boolean;
}

export const PACKAGES: CreditPackage[] = [
  { id: 'pkg_10', name: 'Basic', credits: 10, price: 200, description: 'For occasional generation.' },
  { id: 'pkg_20', name: 'Standard', credits: 20, price: 400, description: 'For regular teachers.', popular: true },
  { id: 'pkg_30', name: 'Premium', credits: 30, price: 500, description: 'For power users.' },
];

export const MPESA_PAYMENT_NUMBER = '0717 713 493';
export const MPESA_CLEAN_NUMBER = '254717713493';

export interface BuyCreditsProps {
  currentUser: User;
  onCancel?: () => void;
  onTransactionSubmitted?: (txNumber: string) => void;
  initialPackageId?: string;
}

const BuyCredits: React.FC<BuyCreditsProps> = ({ currentUser, onCancel, onTransactionSubmitted, initialPackageId }) => {
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [transactionNumber, setTransactionNumber] = useState('');
  const [step, setStep] = useState<'select' | 'pay' | 'pending_verification' | 'error'>('select');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialPackageId) {
      const match = PACKAGES.find(p => p.id === initialPackageId);
      if (match) {
        setSelectedPkg(match);
        setStep('pay');
      }
    }
  }, [initialPackageId]);

  const handleCopyNumber = () => {
    navigator.clipboard.writeText('0717713493').then(() => {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2500);
    });
  };

  const handleSelect = (pkg: CreditPackage) => {
    setSelectedPkg(pkg);
    setStep('pay');
  };

  const validateTransactionNumber = (): boolean => {
    const clean = transactionNumber.trim();
    if (!clean) {
      alert("Please enter your M-Pesa transaction number.");
      return false;
    }
    if (clean.length < 5) {
      alert("Please enter a valid M-Pesa transaction number (minimum 5 characters).");
      return false;
    }
    return true;
  };

  const handleWhatsAppConfirmation = async () => {
    if (!selectedPkg || !validateTransactionNumber()) return;
    const cleanTx = transactionNumber.trim().toUpperCase();
    setIsSubmitting(true);

    // Store transaction locally/in DB as pending verification
    try {
      await SubscriptionService.createTransaction(currentUser.id, selectedPkg.price, cleanTx, selectedPkg.id);
      if (onTransactionSubmitted) {
        onTransactionSubmitted(cleanTx);
      }
    } catch (err: any) {
      console.warn("Transaction store notice:", err.message);
    } finally {
      setIsSubmitting(false);
    }

    const url = SubscriptionService.generateWhatsAppApprovalUrl({
      transactionNumber: cleanTx,
      amount: selectedPkg.price,
      userEmail: currentUser.email,
      packageName: selectedPkg.name,
    });
    window.open(url, "_blank");
    setStep('pending_verification');
  };

  const handleManualConfirmation = async () => {
    if (!selectedPkg || !validateTransactionNumber()) return;
    const cleanTx = transactionNumber.trim().toUpperCase();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await SubscriptionService.createTransaction(currentUser.id, selectedPkg.price, cleanTx, selectedPkg.id);
      if (onTransactionSubmitted) {
        onTransactionSubmitted(cleanTx);
      }
      setStep("pending_verification");
    } catch (err: any) {
      setErrorMessage(err.message || 'Transaction submission failed.');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    setStep('select');
    setSelectedPkg(null);
    setTransactionNumber('');
    if (onCancel) onCancel();
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* SELECT PACKAGE */}
        {step === 'select' && (
          <motion.div 
            key="select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs font-medium">
              <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Simple Manual M-Pesa Payment</p>
                <p className="mt-0.5">Select your package below, send exact payment to <strong className="font-bold">{MPESA_PAYMENT_NUMBER}</strong>, enter your transaction code, and send confirmation.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {PACKAGES.map((pkg, index) => (
                <motion.div 
                  key={pkg.id} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.08 }}
                  className="bg-white p-6 border-2 border-slate-200 rounded-2xl flex flex-col justify-between hover:border-purple-600 transition-all shadow-sm"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-2xl font-black text-slate-900">{pkg.name}</h3>
                      <span className="px-3 py-1 bg-purple-100 text-purple-900 font-black text-xs rounded-full uppercase tracking-wider">
                        {pkg.credits} Credits
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">{pkg.description}</p>
                    <div className="text-3xl font-black text-slate-900 mb-6">
                      KES {pkg.price}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelect(pkg)}
                    className="w-full py-3.5 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    Buy Now
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* PAY & CONFIRM */}
        {step === 'pay' && selectedPkg && (
          <motion.div 
            key="pay"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-lg mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">Selected Package</span>
                <h3 className="text-2xl font-black text-slate-900">PAY KES {selectedPkg.price}</h3>
                <p className="text-xs font-bold text-slate-500">{selectedPkg.name} Package ({selectedPkg.credits} Credits)</p>
              </div>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                title="Back to Packages"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>

            {/* M-Pesa Payment Box */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">M-Pesa Payment Number</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">SEND MONEY</span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-300">
                <span className="text-2xl font-black text-emerald-950 tracking-wider font-mono">{MPESA_PAYMENT_NUMBER}</span>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {copiedNumber ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedNumber ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-emerald-900 font-bold leading-normal">
                Send exact amount <strong className="font-black">KES {selectedPkg.price}</strong> via M-Pesa to 0717 713 493 (Abraham Tumuti), then enter your M-Pesa transaction reference below.
              </p>
            </div>

            {/* Prominent High-Visibility Manual Payment Warning Alert */}
            <div 
              data-testid="manual-payment-warning"
              className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2.5 text-left"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Payments are Manual. Confirm M-Pesa code on phone before clicking Submit.
                  </p>
                  <ul className="text-[11px] text-amber-900 font-medium space-y-1 list-disc list-inside leading-relaxed">
                    <li>Send money manually to <strong className="font-mono text-amber-950">{MPESA_PAYMENT_NUMBER}</strong> via M-Pesa.</li>
                    <li>Verify and confirm the transaction code on your phone SMS receipt before submitting.</li>
                    <li>Submitting the code creates a verification request — credits are not active immediately upon submission.</li>
                    <li>An administrator must manually verify the payment before credits are awarded.</li>
                    <li>The M-Pesa receipt on your phone is the official proof of payment.</li>
                    <li>Submitting an incorrect or fake code will delay or cancel the transaction.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Transaction Number Input */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Enter M-Pesa Transaction Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value.toUpperCase())}
                placeholder="e.g. QK89X123AB"
                className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-slate-900 font-mono font-bold text-lg uppercase outline-none focus:border-purple-600 focus:ring-0 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-500 font-medium">Found in your M-Pesa SMS receipt (e.g. QK89X123AB).</p>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleManualConfirmation}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                {isSubmitting ? 'Submitting...' : 'SUBMIT FOR APPROVAL'}
              </button>

              <button
                type="button"
                onClick={handleWhatsAppConfirmation}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-95"
              >
                <MessageCircle className="h-5 w-5" />
                SEND APPROVAL REQUEST VIA WHATSAPP
              </button>

              <button
                type="button"
                onClick={() => setStep("select")}
                className="w-full py-3 text-slate-600 hover:text-slate-900 font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Back to Packages
              </button>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <p className="text-[11px] text-slate-600 font-bold">
                IMPORTANT: Your credits will be activated after an ECG administrator verifies your payment.
              </p>
            </div>
          </motion.div>
        )}

        {/* PENDING VERIFICATION */}
        {step === 'pending_verification' && (
          <motion.div 
            key="pending_verification"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-lg mx-auto text-center p-8 bg-white border-2 border-slate-200 rounded-3xl space-y-6 shadow-md"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
                STATUS: PENDING VERIFICATION
              </span>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Transaction Submitted
              </h3>
              <p className="text-slate-600 text-sm font-medium mt-2 leading-relaxed">
                Thank you! Your transaction reference <strong className="font-mono text-slate-900 font-black">{transactionNumber}</strong> for <strong className="text-slate-900 font-black">KES {selectedPkg?.price}</strong> has been submitted.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2 text-xs text-amber-950 font-medium">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-700 flex-shrink-0" />
                Manual Verification Process
              </p>
              <p>An ECG administrator will verify your M-Pesa payment and activate your <strong className="font-bold">{selectedPkg?.credits} Credits</strong>.</p>
              <p className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200">
                Note: Entering a transaction number does NOT automatically activate credits. Admin verification is required.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const url = SubscriptionService.generateWhatsAppApprovalUrl({
                    transactionNumber: transactionNumber.trim().toUpperCase(),
                    amount: selectedPkg?.price || 0,
                    userEmail: currentUser.email,
                    packageName: selectedPkg?.name,
                  });
                  window.open(url, '_blank');
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                Send Approval Request via WhatsApp
              </button>

              <button 
                type="button"
                onClick={handleComplete} 
                className="w-full py-3.5 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Back to Subscription
              </button>
            </div>
          </motion.div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-lg mx-auto text-center p-8 bg-white border-2 border-slate-200 rounded-3xl space-y-6 shadow-md"
          >
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 border border-rose-200">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-rose-600 uppercase tracking-tight">Submission Error</h3>
              <p className="text-slate-600 text-sm font-medium mt-2">{errorMessage}</p>
            </div>

            <button 
              onClick={() => setStep('pay')} 
              className="w-full py-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuyCredits;
