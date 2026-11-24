import React from 'react';

interface ExamenoLogoProps {
 className?: string;
 width?: string | number;
 height?: string | number;
}

export const ExamenoLogo: React.FC<ExamenoLogoProps> = ({ className, width, height }) => {
 return (
 <svg 
 className={className} 
 width={width || "100%"} 
 height={height || "100%"} 
 viewBox="0 0 500 400" 
 fill="none" 
 xmlns="http://www.w3.org/2000/svg"
 >
 {/* 1px black border background */}
 <circle cx="250" cy="200" r="198" fill="white" stroke="black" strokeWidth="1"/>

 {/* Graduation Cap top (diamond) */}
 <path d="M250 20 L400 70 L250 120 L100 70 Z" fill="#0f172a"/>
 
 {/* Cap base/skullcap */}
 <path d="M150 90 L150 150 Q250 180 350 150 L350 90" fill="#0f172a"/>
 
 {/* Tassel line and bobble */}
 <path d="M250 70 Q370 80 370 120" stroke="#0f172a" strokeWidth="8" fill="none"/>
 <circle cx="370" cy="125" r="10" fill="#0f172a"/>
 <path d="M365 125 L360 150 L380 150 L375 125" fill="#0f172a"/>

 {/* Open Book Base */}
 <path d="M60 250 Q150 260 250 210 Q350 260 440 250 L420 290 Q350 300 250 250 Q150 300 80 290 Z" fill="#0f172a"/>
 
 {/* Book pages left */}
 <path d="M70 240 Q150 250 240 200 L240 245 Q150 285 80 280 Z" fill="#1e293b"/>
 {/* Book pages right */}
 <path d="M430 240 Q350 250 260 200 L260 245 Q350 285 420 280 Z" fill="#1e293b"/>

 {/* Red Checkmark (The V shape) */}
 <path d="M160 210 L230 270 L390 90" stroke="#dc2626" strokeWidth="45" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>

 {/* Text "Exameno" */}
 <text x="250" y="340" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="85" fill="#0b1736" textAnchor="middle" letterSpacing="-2">
 Exameno
 </text>

 {/* Text "CBE E-LEARNING" */}
 <text x="250" y="375" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="26" fill="#dc2626" textAnchor="middle" letterSpacing="1">
 — CBE E-LEARNING —
 </text>
 </svg>
 );
};
