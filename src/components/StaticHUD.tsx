'use client';

import React, { useState } from 'react';
import StaticHeader from './StaticHeader';
import RoomNavigation from './RoomNavigation';
import HomeStyleSelector from './HomeStyleSelector';
import StateCultureSelector from './StateCultureSelector';

interface StaticHUDProps {
  onClose?: () => void;
}

const StreetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="0 0 13 12" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M4.25509 1.8072C4.45909 1.8468 4.59109 2.0442 4.55089 2.247L3.05089 9.897C3.02896 9.99174 2.97109 10.0742 2.88949 10.1271C2.80788 10.18 2.70893 10.1991 2.61351 10.1804C2.51808 10.1618 2.43364 10.1067 2.378 10.027C2.32236 9.94725 2.29988 9.84901 2.31529 9.753L3.81529 2.103C3.83444 2.00549 3.89151 1.91956 3.97398 1.86409C4.05644 1.80863 4.15755 1.78817 4.25509 1.8072ZM6.28309 1.8C6.57289 1.8 6.80809 2.0352 6.80809 2.325V3.3C6.80809 3.43924 6.75277 3.57278 6.65432 3.67123C6.55586 3.76969 6.42233 3.825 6.28309 3.825C6.14385 3.825 6.01031 3.76969 5.91186 3.67123C5.8134 3.57278 5.75809 3.43924 5.75809 3.3V2.325C5.75809 2.0352 5.99329 1.8 6.28309 1.8ZM6.80809 8.7C6.80809 8.56077 6.75277 8.42723 6.65432 8.32877C6.55586 8.23032 6.42233 8.175 6.28309 8.175C6.14385 8.175 6.01031 8.23032 5.91186 8.32877C5.8134 8.42723 5.75809 8.56077 5.75809 8.7V9.675C5.75809 9.81424 5.8134 9.94778 5.91186 10.0462C6.01031 10.1447 6.14385 10.2 6.28309 10.2C6.42233 10.2 6.55586 10.1447 6.65432 10.0462C6.75277 9.94778 6.80809 9.81424 6.80809 9.675V8.7ZM6.28309 4.9878C6.57289 4.9878 6.80809 5.2224 6.80809 5.5128V6.4878C6.80809 6.62704 6.75277 6.76058 6.65432 6.85904C6.55586 6.95749 6.42233 7.0128 6.28309 7.0128C6.14385 7.0128 6.01031 6.95749 5.91186 6.85904C5.8134 6.76058 5.75809 6.62704 5.75809 6.4878V5.5128C5.75809 5.2224 5.99329 4.9878 6.28309 4.9878ZM8.75089 2.103C8.74291 2.05332 8.72502 2.00574 8.69827 1.96311C8.67152 1.92049 8.63647 1.88368 8.5952 1.85488C8.55392 1.82609 8.50728 1.8059 8.45804 1.79551C8.4088 1.78512 8.35797 1.78475 8.30858 1.79441C8.2592 1.80408 8.21226 1.82359 8.17057 1.85178C8.12888 1.87997 8.0933 1.91626 8.06593 1.95849C8.03856 2.00072 8.01997 2.04803 8.01127 2.0976C8.00257 2.14717 8.00394 2.19798 8.01529 2.247L9.51529 9.897C9.52326 9.94669 9.54116 9.99427 9.5679 10.0369C9.59465 10.0795 9.62971 10.1163 9.67098 10.1451C9.71225 10.1739 9.7589 10.1941 9.80814 10.2045C9.85738 10.2149 9.9082 10.2153 9.95759 10.2056C10.007 10.1959 10.0539 10.1764 10.0956 10.1482C10.1373 10.12 10.1729 10.0837 10.2002 10.0415C10.2276 9.99928 10.2462 9.95197 10.2549 9.90241C10.2636 9.85284 10.2622 9.80203 10.2509 9.753L8.75089 2.103Z" fill="#333333"/>
  </svg>
);

const StaticHUD: React.FC<StaticHUDProps> = () => {
  const [selectedSpace, setSelectedSpace] = useState('Living Room');
  const [selectedStyle, setSelectedStyle] = useState('Jaipuri');
  const [showLeftPanel, setShowLeftPanel] = useState(false);

  const spaces = ['BedRoom', 'Living Room', 'Bathroom'];

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

  return (
    <div className="fixed inset-0 z-20 pointer-events-none font-belleza">
      {/* Top Header */}
      <div className={`absolute left-0 right-0 bg-gradient-to-b from-black to-transparent px-6 py-4 pointer-events-auto transition-all duration-300 ease-in-out ${
        showLeftPanel ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}>
        <StaticHeader />

        {/* Street View Button */}
        <div className="flex justify-end">
          <button className="bg-white text-gray-800 px-4 py-2 rounded-[12px] text-xs font-semibold flex items-center gap-0">
            <StreetIcon />
            STREET VIEW
          </button>
        </div>
      </div>

      {/* Room Navigation */}
      <div className={`transition-all duration-300 ease-in-out ${
        showLeftPanel ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}>
        <RoomNavigation
          rooms={spaces}
          selectedRoom={selectedSpace}
          onRoomSelect={setSelectedSpace}
        />
      </div>

      <HomeStyleSelector
        styles={homeStyles}
        showLeftPanel={showLeftPanel}
        onTogglePanel={() => setShowLeftPanel(!showLeftPanel)}
      />

      {/* Style Selector Bar */}
      <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-in-out ${
        showLeftPanel ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}>
        <StateCultureSelector
          styles={styles}
          selectedStyle={selectedStyle}
          onStyleSelect={setSelectedStyle}
        />
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/64 to-transparent pointer-events-auto" />
    </div>
  );
};

export default StaticHUD;
