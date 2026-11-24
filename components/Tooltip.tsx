
import React from 'react';

interface TooltipProps {
 text: string;
 children: React.ReactNode;
 className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, className = "" }) => (
 <div className={`relative group flex items-center ${className}`}>
 {children}
 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-slate-900 border border-slate-200 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
 {text}
 </div>
 </div>
);
