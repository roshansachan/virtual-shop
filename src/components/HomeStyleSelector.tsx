'use client';

import React from 'react';
import Image from 'next/image';

// SVG Icon Components
const ChevronRight = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const X = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface HomeStyle {
  id: string;
  name: string;
  image: string;
}

interface HomeStyleSelectorProps {
  styles: HomeStyle[];
  selectedStyle: string;
  onStyleSelect: (styleName: string) => void;
  showLeftPanel: boolean;
  onTogglePanel: () => void;
  disablePointerEvents?: boolean;
}

const HomeStyleSelector: React.FC<HomeStyleSelectorProps> = ({ styles, selectedStyle, onStyleSelect, showLeftPanel, onTogglePanel, disablePointerEvents }) => {

  return (
    <>
      {/* Left Panel Toggle */}
      <div className={`absolute inline-flex bg-black/50 rounded-b-lg p-2 pointer-events-auto origin-top-left -rotate-90 transition-all duration-300 ease-in-out font-belleza ${showLeftPanel ? 'left-52 top-96' : 'left-0 top-96'} ${disablePointerEvents ? 'pointer-events-none' : 'pointer-events-auto'}`}>
        <button
          onClick={onTogglePanel}
          className="text-white text-xs uppercase writing-mode-vertical-rl transform px-2"
        >
          HOME STYLES
        </button>
        <ChevronRight size={16} className={`transition-transform duration-300 ease-in-out text-white ${showLeftPanel ? "-rotate-90" : "rotate-90"}`} />
      </div>

      {/* Left Panel */}
      <div className={`absolute left-0 top-0 bottom-0 w-52 bg-black/50 overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out font-belleza ${
        showLeftPanel 
          ? 'translate-x-0 opacity-100' 
          : '-translate-x-full opacity-0'
      }`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-sm uppercase font-normal">HOME STYLES</h3>
            <button
              onClick={onTogglePanel}
              className="w-6 h-6 bg-transparent rounded-full flex items-center justify-center"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          <div className="space-y-3">
            {styles.map((style, index) => (
              <div 
                key={index} 
                className={`relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                  selectedStyle === style.id ? 'ring-2 ring-white' : 'hover:ring-1 hover:ring-white/50'
                }`}
                onClick={() => onStyleSelect(style.id)}
              >
                <div className="aspect-[174/104] relative">
                  <img
                    src={style.image}
                    alt={style.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="text-white text-sm font-normal text-center">{style.name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default HomeStyleSelector;
