import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  History,
  Info,
  Inbox,
  Share2,
  HelpCircle,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  ArrowRight,
  X,
  Search,
  ExternalLink
} from 'lucide-react';
import { User, CreditLog } from '../types.ts';
import BuyCredits, { PACKAGES } from './BuyCredits.tsx';
import ReferralHub from './ReferralHub.tsx';
import { SubscriptionService } from '../services/subscriptionService';
import { SubscriptionTransaction } from '../types/subscription';
import {
  normalizeTransactionStatus,
  getTransactionStatusLabel,
  getTransactionBadgeClasses,
  isTransactionPending,
  isTransactionVerified,
  generateWhatsAppApprovalUrl
} from '../utils/transactionStatus';

interface SubscriptionPanelProps {
  currentUser: User;
  onReferralsClick?: () => void;
}

const MPESA_NUMBER = '0717 713 493';

export const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({ currentUser, onReferralsClick }) => {
  const [submittedTx, setSubmittedTx] = useState<SubscriptionTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [copiedMpesa, setCopiedMpesa] = useState<boolean>(false);
  const [showAllModal, setShowAllModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'transactions' | 'ledger'>('transactions');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false);

  // Fetch user transactions
  const fetchUserTx = async () => {
    if (!currentUser?.id) return;
    setLoadingTx(true);
    try {
      const txs = await SubscriptionService.getUserTransactions(currentUser.id);
      setSubmittedTx(txs);
    } catch (err) {
      console.warn('Failed to fetch user transactions:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;
    fetchUserTx();

    const unsubscribe = SubscriptionService.subscribeToUserTransactions(currentUser.id, (txs) => {
      if (isMounted) {
        setSubmittedTx(txs);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.id]);

  // Copy M-Pesa Number
  const handleCopyNumber = () => {
    navigator.clipboard.writeText('0717713493').then(() => {
      setCopiedMpesa(true);
      setTimeout(() => setCopiedMpesa(false), 2500);
    });
  };

  // Smooth scroll to credit packages
  const handleScrollToPackages = () => {
    const el = document.getElementById('credit-packages');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 1. Calculations: Total Used
  const totalUsed = useMemo(() => {
    if (!currentUser.creditLogs || !Array.isArray(currentUser.creditLogs)) return 0;
    return Math.abs(
      currentUser.creditLogs
        .filter(l => typeof l.creditsUsed === 'number' && l.creditsUsed < 0)
        .reduce((sum, l) => sum + l.creditsUsed, 0)
    );
  }, [currentUser.creditLogs]);

  // 2. Calculations: Total Purchased (Only VERIFIED transactions count)
  const totalPurchased = useMemo(() => {
    // A: Verified transactions from database
    const verifiedTxCredits = submittedTx
      .filter(tx => isTransactionVerified(tx.status))
      .reduce((sum, tx) => {
        if (tx.packageId === 'pkg_10' || tx.amount === 200) return sum + 10;
        if (tx.packageId === 'pkg_20' || tx.amount === 400) return sum + 20;
        if (tx.packageId === 'pkg_30' || tx.amount === 500) return sum + 30;
        return sum + Math.floor((tx.amount || 0) / 20);
      }, 0);

    // B: Verified purchase actions in user credit logs
    const logPurchaseCredits = (currentUser.creditLogs || [])
      .filter(l => typeof l.creditsUsed === 'number' && l.creditsUsed > 0 && /purchas/i.test(l.action || ''))
      .reduce((sum, l) => sum + l.creditsUsed, 0);

    return Math.max(verifiedTxCredits, logPurchaseCredits);
  }, [submittedTx, currentUser.creditLogs]);

  // 3. Calculations: Member Since
  const memberSince = useMemo(() => {
    const dateVal = currentUser.createdAt || (currentUser as any).dateJoined;
    if (!dateVal) return 'Recently';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  }, [currentUser.createdAt, (currentUser as any).dateJoined]);

  // Recent Transactions (3-5 items)
  const recentTransactions = useMemo(() => {
    return submittedTx.slice(0, 5);
  }, [submittedTx]);

  // Filtered transactions for the modal
  const filteredModalTransactions = useMemo(() => {
    if (!modalSearch.trim()) return submittedTx;
    const q = modalSearch.trim().toLowerCase();
    return submittedTx.filter(tx =>
      tx.transactionNumber.toLowerCase().includes(q) ||
      (tx.amount && tx.amount.toString().includes(q)) ||
      (tx.status && tx.status.toLowerCase().includes(q))
    );
  }, [submittedTx, modalSearch]);

  // Sorted credit logs for ledger
  const sortedLogs = useMemo(() => {
    return [...(currentUser.creditLogs || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [currentUser.creditLogs]);

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-24 text-slate-800">
      {/* 1. Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#3b1464] mb-1 block">
          Account & Billing
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight">
          Subscription & Credits
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
          Buy credits, track your usage, and view your transaction history.
        </p>
      </div>

      {/* 2. Credit Balance Summary Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Current Balance
              </span>
              <span className="px-2.5 py-0.5 bg-purple-50 text-[#3b1464] border border-purple-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                {currentUser.role ? `${currentUser.role.toUpperCase()} ACCOUNT` : 'TEACHER ACCOUNT'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                {typeof currentUser.credits === 'number' ? currentUser.credits.toLocaleString() : 0}
              </span>
              <span className="text-lg sm:text-xl font-bold text-slate-500">Credits</span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleScrollToPackages}
              className="px-5 py-3 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>Buy More Credits</span>
            </button>
          </div>
        </div>

        {/* 3 Stats Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Total Purchased
            </p>
            <p className="text-2xl font-black text-emerald-700">
              {totalPurchased.toLocaleString()} <span className="text-xs font-bold text-emerald-900">Credits</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Verified payments only</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Total Used
            </p>
            <p className="text-2xl font-black text-slate-800">
              {totalUsed.toLocaleString()} <span className="text-xs font-bold text-slate-500">Credits</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Generated teaching content</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Member Since
            </p>
            <p className="text-xl font-black text-slate-900">
              {memberSince}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Active teacher account</p>
          </div>
        </div>
      </div>

      {/* 3. Credit Policy Notice */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
        <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-800 flex-shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="text-xs font-medium text-emerald-950 space-y-0.5">
          <p className="font-black text-emerald-950 text-sm">
            Credits are only deducted when a document is successfully generated.
          </p>
          <p className="text-emerald-800 text-xs">
            If generation fails or is interrupted, your credits are completely safe.
          </p>
        </div>
      </div>

      {/* 4. Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleScrollToPackages}
            className="p-5 bg-white border border-slate-200 hover:border-[#3b1464] rounded-2xl text-left transition-all group shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#3b1464] flex items-center justify-center mb-3 group-hover:bg-[#3b1464] group-hover:text-white transition-colors">
              <CreditCard className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">Buy Credits</h4>
            <p className="text-xs text-slate-500 font-medium mt-1">Choose a package & pay via M-Pesa</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalTab('transactions');
              setShowAllModal(true);
            }}
            className="p-5 bg-white border border-slate-200 hover:border-[#3b1464] rounded-2xl text-left transition-all group shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#3b1464] flex items-center justify-center mb-3 group-hover:bg-[#3b1464] group-hover:text-white transition-colors">
              <History className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">Transaction History</h4>
            <p className="text-xs text-slate-500 font-medium mt-1">View all payments & credit usage ledger</p>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onReferralsClick) {
                onReferralsClick();
              } else {
                setShowReferralModal(true);
              }
            }}
            className="p-5 bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl text-left transition-all group shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Share2 className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">Referrals</h4>
            <p className="text-xs text-slate-500 font-medium mt-1">Earn free credits by inviting fellow teachers</p>
          </button>
        </div>
      </div>

      {/* 5. M-Pesa Payment Guide */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#3b1464] block mb-1">
              Payment Guide
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              Pay via M-Pesa
            </h2>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Send Money to</p>
              <p className="text-xl font-black text-emerald-950 font-mono tracking-wider">{MPESA_NUMBER}</p>
              <p className="text-[11px] text-emerald-800 font-bold">(Abraham Tumuti)</p>
            </div>
            <button
              type="button"
              onClick={handleCopyNumber}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              {copiedMpesa ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedMpesa ? 'Copied' : 'Copy Number'}</span>
            </button>
          </div>
        </div>

        {/* 4 Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-6 h-6 rounded-full bg-[#3b1464] text-white text-xs font-black flex items-center justify-center">1</span>
              <h4 className="text-xs font-black uppercase text-slate-900">Choose Package</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Select 10, 20, or 30 credits below based on your curriculum needs.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-6 h-6 rounded-full bg-[#3b1464] text-white text-xs font-black flex items-center justify-center">2</span>
              <h4 className="text-xs font-black uppercase text-slate-900">Send Payment</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Send exact amount to <strong className="font-mono text-slate-900 font-bold">{MPESA_NUMBER}</strong> (Abraham Tumuti).
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-6 h-6 rounded-full bg-[#3b1464] text-white text-xs font-black flex items-center justify-center">3</span>
              <h4 className="text-xs font-black uppercase text-slate-900">Enter Code</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Enter the M-Pesa transaction reference from your phone SMS receipt.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-6 h-6 rounded-full bg-[#3b1464] text-white text-xs font-black flex items-center justify-center">4</span>
              <h4 className="text-xs font-black uppercase text-slate-900">Submit for Approval</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Submit your request. An admin manually verifies and activates credits.
            </p>
          </div>
        </div>

        {/* High-Visibility Manual Payment Warning Box */}
        <div
          data-testid="manual-payment-warning"
          className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 text-left"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-black text-amber-950 uppercase tracking-wide">
                Payments are Manual. Confirm M-Pesa code on phone before clicking Submit.
              </p>
              <ul className="text-[11px] text-amber-900 font-medium space-y-1 list-disc list-inside leading-relaxed">
                <li>Send money manually to <strong className="font-mono text-amber-950">{MPESA_NUMBER}</strong> via M-Pesa.</li>
                <li>Verify and confirm the transaction code on your phone SMS receipt before submitting.</li>
                <li>Submitting the code creates a verification request — credits are not active immediately upon submission.</li>
                <li>An administrator must manually verify the payment before credits are awarded.</li>
                <li>The M-Pesa receipt on your phone is the official proof of payment.</li>
                <li>Submitting an incorrect or fake code will delay or cancel the transaction.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Credit Packages */}
      <div id="credit-packages" className="space-y-4 pt-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#3b1464] block mb-1">
            Choose Your Plan
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Credit Packages
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Choose the credit package that best fits your curriculum planning and assessment needs.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <BuyCredits
            currentUser={currentUser}
            onTransactionSubmitted={() => {
              fetchUserTx();
            }}
          />
        </div>
      </div>

      {/* 7. Recent Transactions */}
      <div id="recent-transactions" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
              Recent Transactions
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Showing your 5 most recent payment submissions
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalTab('transactions');
              setShowAllModal(true);
            }}
            className="text-xs font-black text-[#3b1464] hover:text-purple-800 uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
            <Inbox className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No payment transactions recorded yet.</p>
            <p className="text-[11px] text-slate-500">
              When you purchase credits, your submitted M-Pesa transactions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((tx) => {
              const canonicalStatus = normalizeTransactionStatus(tx.status);
              const statusLabel = getTransactionStatusLabel(tx.status, 'user');
              const badgeClasses = getTransactionBadgeClasses(tx.status);
              const isPending = isTransactionPending(tx.status);

              const pkgInfo =
                tx.packageId === 'pkg_10' || tx.amount === 200 ? '10 Credits' :
                tx.packageId === 'pkg_20' || tx.amount === 400 ? '20 Credits' :
                tx.packageId === 'pkg_30' || tx.amount === 500 ? '30 Credits' :
                `${Math.floor((tx.amount || 0) / 20)} Credits`;

              const txDate = tx.createdAt
                ? new Date(tx.createdAt?.seconds ? tx.createdAt.seconds * 1000 : tx.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : 'Recently';

              return (
                <div
                  key={tx.id || tx.transactionNumber}
                  data-testid={`user-tx-${tx.transactionNumber}`}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-slate-900 text-sm uppercase">
                        {tx.transactionNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-700">— KES {tx.amount}</span>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        {pkgInfo}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Submitted on {txDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-wider ${badgeClasses.full}`}>
                      {statusLabel}
                    </span>

                    {isPending && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = generateWhatsAppApprovalUrl({
                            transactionNumber: tx.transactionNumber,
                            amount: tx.amount,
                            userEmail: currentUser.email,
                            packageName: pkgInfo,
                          });
                          window.open(url, '_blank');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Send approval request to admin via WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Send Approval Request</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setModalTab('transactions');
              setShowAllModal(true);
            }}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <History className="h-4 w-4" />
            <span>View All Transactions & Credit Ledger</span>
          </button>
        </div>
      </div>

      {/* 8. Payment FAQ & Support */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
          <div className="p-2.5 bg-purple-100 rounded-2xl text-[#3b1464]">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">Payment FAQ & Support</h3>
            <p className="text-xs text-slate-500 font-medium">Answers to common questions about purchasing and managing credits.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> How do I buy credits?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              Choose a package above, pay the exact amount to 0717 713 493 (Abraham Tumuti) via M-Pesa, enter your transaction number, and submit for approval.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> When will my credits be activated?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              Your credits are activated after an ECG administrator verifies your M-Pesa payment in our account records.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> Does entering the code activate credits immediately?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              No. Entering the transaction code creates a verification request. Administrator verification is required before credits are granted.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> What if I enter the wrong transaction number?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              Your payment will not be verified until the correct reference is confirmed. You can reach out via WhatsApp with your M-Pesa SMS receipt.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> Are my credits safe if generation fails?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              Yes. Credits are only deducted when content is generated successfully. If generation fails or errors, zero credits are deducted.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 flex items-start gap-2">
              <span className="text-[#3b1464] font-bold">Q:</span> How do I contact support?
            </h4>
            <p className="text-xs text-slate-600 font-medium leading-relaxed pl-4">
              You can contact Abraham Tumuti via WhatsApp at 0717 713 493 for payment queries, receipts, or verification assistance.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Full Transaction History & Credit Ledger */}
      <AnimatePresence>
        {showAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                    Complete History & Ledger
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    All payment submissions and document credit deductions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setModalTab('transactions')}
                  className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
                    modalTab === 'transactions'
                      ? 'border-[#3b1464] text-[#3b1464] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  M-Pesa Payments ({submittedTx.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('ledger')}
                  className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider transition-colors border-b-2 ${
                    modalTab === 'ledger'
                      ? 'border-[#3b1464] text-[#3b1464] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Credit Ledger ({sortedLogs.length})
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {modalTab === 'transactions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          placeholder="Search by transaction code, amount, status..."
                          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#3b1464] outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={fetchUserTx}
                        disabled={loadingTx}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingTx ? 'animate-spin text-[#3b1464]' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {filteredModalTransactions.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                        <Inbox className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No transactions found</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredModalTransactions.map((tx) => {
                          const statusLabel = getTransactionStatusLabel(tx.status, 'user');
                          const badgeClasses = getTransactionBadgeClasses(tx.status);
                          const isPending = isTransactionPending(tx.status);

                          const pkgInfo =
                            tx.packageId === 'pkg_10' || tx.amount === 200 ? '10 Credits' :
                            tx.packageId === 'pkg_20' || tx.amount === 400 ? '20 Credits' :
                            tx.packageId === 'pkg_30' || tx.amount === 500 ? '30 Credits' :
                            `${Math.floor((tx.amount || 0) / 20)} Credits`;

                          const txDate = tx.createdAt
                            ? new Date(tx.createdAt?.seconds ? tx.createdAt.seconds * 1000 : tx.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'Recently';

                          return (
                            <div
                              key={tx.id || tx.transactionNumber}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-slate-900 text-xs uppercase">
                                    {tx.transactionNumber}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700">KES {tx.amount}</span>
                                  <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                    {pkgInfo}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">Submitted: {txDate}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase ${badgeClasses.full}`}>
                                  {statusLabel}
                                </span>
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = generateWhatsAppApprovalUrl({
                                        transactionNumber: tx.transactionNumber,
                                        amount: tx.amount,
                                        userEmail: currentUser.email,
                                        packageName: pkgInfo,
                                      });
                                      window.open(url, '_blank');
                                    }}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs transition-colors"
                                    title="Send approval via WhatsApp"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {modalTab === 'ledger' && (
                  <div>
                    {sortedLogs.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                        <Inbox className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No credit logs recorded</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Your credit deductions and grants will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Action</th>
                              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Credits</th>
                              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {sortedLogs.map((log, index) => (
                              <tr key={log.id || index} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                  {new Date(log.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                  {log.action}
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap text-right font-black ${log.creditsUsed > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {log.creditsUsed > 0 ? '+' : ''}{log.creditsUsed}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-900">
                                  {typeof log.balance === 'number' ? log.balance : '...'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAllModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Referral Hub */}
      <AnimatePresence>
        {showReferralModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                    Teacher Referral Hub
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Invite colleagues and earn free credits
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <ReferralHub currentUser={currentUser} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionPanel;
