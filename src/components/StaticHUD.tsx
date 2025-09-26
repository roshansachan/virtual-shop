'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface StaticHUDProps {
  onClose?: () => void;
}

// SVG Icon Components
const ChevronLeft = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronRight = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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

const X = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Home = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="0 0 13 12" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M4.25509 1.8072C4.45909 1.8468 4.59109 2.0442 4.55089 2.247L3.05089 9.897C3.02896 9.99174 2.97109 10.0742 2.88949 10.1271C2.80788 10.18 2.70893 10.1991 2.61351 10.1804C2.51808 10.1618 2.43364 10.1067 2.378 10.027C2.32236 9.94725 2.29988 9.84901 2.31529 9.753L3.81529 2.103C3.83444 2.00549 3.89151 1.91956 3.97398 1.86409C4.05644 1.80863 4.15755 1.78817 4.25509 1.8072ZM6.28309 1.8C6.57289 1.8 6.80809 2.0352 6.80809 2.325V3.3C6.80809 3.43924 6.75277 3.57278 6.65432 3.67123C6.55586 3.76969 6.42233 3.825 6.28309 3.825C6.14385 3.825 6.01031 3.76969 5.91186 3.67123C5.8134 3.57278 5.75809 3.43924 5.75809 3.3V2.325C5.75809 2.0352 5.99329 1.8 6.28309 1.8ZM6.80809 8.7C6.80809 8.56077 6.75277 8.42723 6.65432 8.32877C6.55586 8.23032 6.42233 8.175 6.28309 8.175C6.14385 8.175 6.01031 8.23032 5.91186 8.32877C5.8134 8.42723 5.75809 8.56077 5.75809 8.7V9.675C5.75809 9.81424 5.8134 9.94778 5.91186 10.0462C6.01031 10.1447 6.14385 10.2 6.28309 10.2C6.42233 10.2 6.55586 10.1447 6.65432 10.0462C6.75277 9.94778 6.80809 9.81424 6.80809 9.675V8.7ZM6.28309 4.9878C6.57289 4.9878 6.80809 5.2224 6.80809 5.5128V6.4878C6.80809 6.62704 6.75277 6.76058 6.65432 6.85904C6.55586 6.95749 6.42233 7.0128 6.28309 7.0128C6.14385 7.0128 6.01031 6.95749 5.91186 6.85904C5.8134 6.76058 5.75809 6.62704 5.75809 6.4878V5.5128C5.75809 5.2224 5.99329 4.9878 6.28309 4.9878ZM8.75089 2.103C8.74291 2.05332 8.72502 2.00574 8.69827 1.96311C8.67152 1.92049 8.63647 1.88368 8.5952 1.85488C8.55392 1.82609 8.50728 1.8059 8.45804 1.79551C8.4088 1.78512 8.35797 1.78475 8.30858 1.79441C8.2592 1.80408 8.21226 1.82359 8.17057 1.85178C8.12888 1.87997 8.0933 1.91626 8.06593 1.95849C8.03856 2.00072 8.01997 2.04803 8.01127 2.0976C8.00257 2.14717 8.00394 2.19798 8.01529 2.247L9.51529 9.897C9.52326 9.94669 9.54116 9.99427 9.5679 10.0369C9.59465 10.0795 9.62971 10.1163 9.67098 10.1451C9.71225 10.1739 9.7589 10.1941 9.80814 10.2045C9.85738 10.2149 9.9082 10.2153 9.95759 10.2056C10.007 10.1959 10.0539 10.1764 10.0956 10.1482C10.1373 10.12 10.1729 10.0837 10.2002 10.0415C10.2276 9.99928 10.2462 9.95197 10.2549 9.90241C10.2636 9.85284 10.2622 9.80203 10.2509 9.753L8.75089 2.103Z" fill="#333333"/>
  </svg>
);

const Sun = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
    <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sunrise = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M17 18C17 16.6739 16.4732 15.4021 15.5355 14.4645C14.5979 13.5268 13.3261 13 12 13C10.6739 13 9.40215 13.5268 8.46447 14.4645C7.52678 15.4021 7 16.6739 7 18" stroke="currentColor" strokeWidth="2"/>
    <line x1="12" y1="9" x2="12" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="23" y1="22" x2="1" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="8,6 12,2 16,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sunset = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M17 18C17 16.6739 16.4732 15.4021 15.5355 14.4645C14.5979 13.5268 13.3261 13 12 13C10.6739 13 9.40215 13.5268 8.46447 14.4645C7.52678 15.4021 7 16.6739 7 18" stroke="currentColor" strokeWidth="2"/>
    <line x1="12" y1="9" x2="12" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="18" x2="23" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="23" y1="22" x2="1" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="16,6 12,2 8,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Moon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M21 12.79C20.8427 14.4922 20.2039 16.1144 19.1583 17.4668C18.1127 18.8192 16.7035 19.8458 15.0957 20.4265C13.4879 21.0073 11.7431 21.1181 10.0710 20.7461C8.39898 20.3741 6.86928 19.5345 5.67442 18.3396C4.47956 17.1448 3.64016 15.6151 3.26816 13.9430C2.89615 12.2709 3.00701 10.5261 3.58777 8.91832C4.16853 7.31053 5.19503 5.90131 6.54743 4.85571C7.89983 3.81011 9.52203 3.17157 11.21 3.01005C10.2133 4.08519 9.65685 5.44816 9.65685 6.85005C9.65685 8.25194 10.2133 9.61491 11.21 10.69C12.2067 11.7651 13.5697 12.3216 14.9716 12.3216C16.3734 12.3216 17.7364 11.7651 18.7331 10.69C19.7298 9.61491 20.2863 8.25194 20.2863 6.85005C20.2863 5.44816 19.7298 4.08519 18.7331 3.01005" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StaticHUD: React.FC<StaticHUDProps> = () => {
  const [selectedRoom, setSelectedRoom] = useState('Living Room');
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState('day');
  const [selectedStyle, setSelectedStyle] = useState('Jaipuri');
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const rooms = ['BedRoom', 'Living Room', 'Bathroom'];
  const timeOfDay = [
    { key: 'sunrise', label: 'Sunrise', icon: Sunrise },
    { key: 'day', label: 'Day', icon: Sun },
    { key: 'sunset', label: 'Sunset', icon: Sunset },
    { key: 'night', label: 'Night', icon: Moon },
  ];

  const styles = [
    { name: 'Lucknavi', color: 'bg-orange-200' },
    { name: 'Gujrati', color: 'bg-green-200' },
    { name: 'Tamil', color: 'bg-blue-200' },
    { name: 'Jaipuri', color: 'bg-purple-200' },
    { name: 'Kashmiri', color: 'bg-pink-200' },
    { name: 'Telugu', color: 'bg-yellow-200' },
    { name: 'Malayalami', color: 'bg-red-200' },
  ];

  const homeStyles = [
    { name: 'Indian', image: '/api/placeholder/174/104' },
    { name: 'American country', image: '/api/placeholder/174/104' },
    { name: 'American', image: '/api/placeholder/174/104' },
    { name: 'Scandinavian', image: '/api/placeholder/174/104' },
    { name: 'French Country', image: '/api/placeholder/174/104' },
    { name: 'Bohemian', image: '/api/placeholder/174/104' },
    { name: 'American Colonial', image: '/api/placeholder/174/104' },
    { name: 'Regency', image: '/api/placeholder/174/104' },
  ];

  const productOptions = [
    {
      name: 'Jaipuri Block Printed Sheet',
      price: '$1299',
      originalPrice: '$1800',
      discount: '40% off',
      image: '/api/placeholder/292/204',
    },
    {
      name: 'Jaipuri Red Black Tablet Runner',
      price: '$1299',
      originalPrice: '$1800',
      discount: '40% off',
      image: '/api/placeholder/252/176',
    },
    {
      name: 'Jaipuri Red Yellow Table Runner',
      price: '$1299',
      originalPrice: '$1800',
      discount: '40% off',
      image: '/api/placeholder/252/176',
    },
    {
      name: 'Jaipuri Bird Watch Runner',
      price: '$1299',
      originalPrice: '$1800',
      discount: '40% off',
      image: '/api/placeholder/252/176',
    },
  ];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none font-belleza">
      {/* Top Header */}
      <div className="absolute left-0 right-0 bg-gradient-to-b from-black to-transparent px-6 py-4 pointer-events-auto">
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

        {/* Street View Button */}
        <div className="flex justify-end">
          <button className="bg-white text-gray-800 px-4 py-2 rounded-[12px] text-xs font-semibold flex items-center gap-0">
            <Home />
            STREET VIEW
          </button>
        </div>
      </div>

      {/* Room Navigation */}
      <div className="absolute top-30 left-9 right-9 bg-black/60 rounded-2xl px-4 py-2 pointer-events-auto">
        <div className="flex items-center justify-between">
          <button className="w-3 h-3 text-white">
            <ChevronLeft size={12} />
          </button>
          
          <div className="flex items-center gap-6">
            {rooms.map((room) => (
              <button
                key={room}
                onClick={() => setSelectedRoom(room)}
                className={`text-xs uppercase ${
                  selectedRoom === room 
                    ? 'text-white font-semibold' 
                    : 'text-white/70'
                }`}
              >
                {room}
              </button>
            ))}
          </div>
          
          <button className="w-3 h-3 text-white">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Left Panel Toggle */}
      <div className="absolute inline-flex left-0 top-96 bg-black/60 rounded-b-lg p-2 pointer-events-auto origin-top-left -rotate-90">
        <button 
          onClick={() => setShowLeftPanel(!showLeftPanel)}
          className="text-white text-xs uppercase writing-mode-vertical-rl transform px-2"
        >
          HOME STYLES
        </button>
        <ChevronRight size={16} className="rotate-90" />
      </div>

      {/* Left Panel */}
      {showLeftPanel && (
        <div className="absolute left-0 top-0 bottom-0 w-52 bg-black/48 overflow-y-auto pointer-events-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-sm uppercase font-normal">HOME STYLES</h3>
              <button 
                onClick={() => setShowLeftPanel(false)}
                className="w-6 h-6 bg-transparent rounded-full flex items-center justify-center"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
            
            <div className="space-y-3">
              {homeStyles.map((style, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden">
                  <div className="aspect-[174/104] bg-gray-300 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                      <span className="text-white text-sm font-normal">{style.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Style Selector Bar */}
      <div className="absolute bottom-0 left-0 right-0 overflow-x-auto pointer-events-auto">
        <div className="flex items-center gap-4 px-4 py-3">
          {styles.map((style) => (
            <button
              key={style.name}
              onClick={() => setSelectedStyle(style.name)}
              className={`flex items-center gap-2 px-3 py-2 whitespace-nowrap ${
                selectedStyle === style.name 
                  ? 'border-b-2 border-white' 
                  : ''
              }`}
            >
              <span className="text-white text-sm">{style.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/64 to-transparent pointer-events-auto" />
    </div>
  );
};

export default StaticHUD;
