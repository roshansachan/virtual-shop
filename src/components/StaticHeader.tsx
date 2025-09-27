'use client';

import React from 'react';
import Image from 'next/image';

// SVG Icon Components
const Search = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const User = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const ShoppingCart = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
    <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
    <path d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StaticHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-4">
      {/* Logo */}
      <Image src="/mool.png" alt="Mool" width={80} height={24} className="object-contain" />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button className="w-6 h-6 text-white">
          <Search size={20} />
        </button>
        <button className="w-6 h-6 text-white">
          <User size={20} />
        </button>
        <button className="w-6 h-6 text-white">
          <ShoppingCart size={20} />
        </button>
      </div>
    </div>
  );
};

export default StaticHeader;
