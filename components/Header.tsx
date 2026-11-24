

import React from 'react';
import { motion } from 'motion/react';
import { Download, LogOut, Wallet, Bell, Building2, ChevronDown } from 'lucide-react';
import { User } from '../types.ts';
import { usePWA } from '../hooks/usePWA';
import { ExamenoLogo } from './ExamenoLogo';

interface HeaderProps {
 grade: string;
 subject: string;
 currentUser?: User;
 activeSchoolName?: string;
 onLogout?: () => void;
 onProfileClick?: () => void;
 onCreditsClick?: () => void;
 onNotificationClick?: () => void;
 onSwitchSchoolClick?: () => void;
 unreadCount?: number;
}

const getInitials = (name: string) => {
 if (!name) return '';
 const names = name.split(' ');
 if (names.length > 1) {
 return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
 }
 return name.substring(0, 2).toUpperCase();
};

const Header: React.FC<HeaderProps> = ({ grade, subject, currentUser, activeSchoolName, onLogout, onProfileClick, onCreditsClick, onNotificationClick, onSwitchSchoolClick, unreadCount = 0 }) => {

 return (
 <header className="bg-white border-b border-slate-200 sticky top-0 z-20 print:hidden transition-all duration-300 shadow-sm">
 <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
 <div className="flex items-center justify-between">
  <div className="flex items-center space-x-3 sm:space-x-4">
  <div className="flex-shrink-0 flex items-center bg-white p-1.5 sm:p-2 rounded-xl border border-slate-100 shadow-sm transition-transform hover:scale-105">
  <ExamenoLogo className="h-8 w-8 sm:h-10 sm:w-10" />
  </div>
  
  <div className="flex items-center">
  <span className="text-base sm:text-lg font-black text-[#3b1464] leading-tight uppercase tracking-tight">EXAMENO</span>
  </div>

 {activeSchoolName && (
 <button
 onClick={onSwitchSchoolClick}
 className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 bg-white border border-slate-200 rounded-full hover:bg-purple-50 transition-colors max-w-[150px] sm:max-w-[200px]"
 title="Click to switch active school"
 >
 <Building2 className="h-3.5 w-3.5 text-purple-900 flex-shrink-0" />
 <span className="text-xs font-bold text-slate-900 truncate">{activeSchoolName}</span>
 <ChevronDown className="h-3 w-3 text-slate-500 flex-shrink-0" />
 </button>
 )}
 </div>
 <div className="flex items-center gap-x-2 sm:gap-x-4">
 {currentUser && (
  <div className="flex items-center gap-2 sm:gap-3">
  <motion.button 
  whileHover={{ scale: 1.1 }}
  onClick={onNotificationClick}
  className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-900 hover:text-purple-900 transition-colors"
  title="Notifications"
  aria-label="Notifications"
  >
  <Bell className="h-5 w-5" />
  {unreadCount > 0 && (
  <span className="absolute top-2 right-2 h-2 w-2 bg-rose-600 rounded-full"></span>
  )}
  </motion.button>
 <motion.div 
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 min-h-[40px] bg-white border border-slate-200 rounded-full cursor-pointer hover:border-purple-300 transition-colors"
 onClick={onCreditsClick || onProfileClick}
 title="Credit balance - click to view"
 >
 <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-900" />
 <span className="text-xs sm:text-sm font-semibold text-purple-950">
 {typeof currentUser.credits === 'number' ? currentUser.credits : '...'}
 </span>
 </motion.div>
 <div className="text-right hidden sm:block font-sans cursor-pointer" onClick={onProfileClick}>
 <p className="text-sm font-semibold text-slate-900 font-sans leading-tight">{currentUser.name}</p>
 <p className="text-xs text-purple-900 font-bold capitalize font-sans leading-tight">{currentUser.role}</p>
 </div>
 <motion.button 
 type="button"
 whileHover={{ scale: 1.05 }}
 onClick={onProfileClick}
 className="inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full cursor-pointer bg-[#3b1464] font-sans border border-purple-900 text-white font-bold"
 title="User profile"
 aria-label="User profile"
 >
 <span className="text-sm font-bold text-white font-sans">{getInitials(currentUser.name)}</span>
 </motion.button>
 {onLogout && (
 <motion.button 
 whileHover={{ scale: 1.1, color: '#ef4444' }}
 whileTap={{ scale: 0.9 }}
 onClick={onLogout}
 className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-900 hover:text-red-500 transition-colors"
 title="Logout"
 aria-label="Logout"
 >
 <LogOut className="h-5 w-5" />
 </motion.button>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 </header>
 );
};

export default Header;
