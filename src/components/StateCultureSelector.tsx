'use client';

import React from 'react';

interface Style {
  id: string;
  name: string;
  image: string;
  themeImage?: string;
}

interface StateCultureSelectorProps {
  styles: Style[];
  selectedStyle: string;
  onStyleSelect: (sceneId: string) => void;
  disablePointerEvents?: boolean;
}

const StateCultureSelector: React.FC<StateCultureSelectorProps> = ({
  styles,
  selectedStyle,
  onStyleSelect,
  disablePointerEvents
}) => {
  return (
    <div className={`state-culture-selector flex items-end justify-start w-full gap-4 px-4 py-3 overflow-x-auto h-[150px] ${disablePointerEvents ? 'pointer-events-none' : 'pointer-events-auto'}`}
         style={{ background: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.64) 100%)' }}>
      {styles.map((style) => (
        <button
          key={style.id}
          onClick={() => onStyleSelect(style.id)}
          className={`flex items-center whitespace-nowrap flex-shrink-0 h-8 ${
            selectedStyle === style.id
              ? 'rounded-full  px-3'
              : ''
          }`}
          style={selectedStyle === style.id ? {
            background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.64) 50.82%, rgba(0, 0, 0, 0.4) 100%)'
          } : undefined}
        >
          {style.themeImage ? (
            <div className={`flex items-center gap-1.5`}>
              <img
              src={style.themeImage}
              alt={style.name}
              className={`h-[16px] w-auto object-contain`}
            />
              <span className="text-white text-sm ">{style.name}</span>
            </div> 

            
            
          ) : (
            <span className="text-white text-sm px-3 py-2">{style.name}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default StateCultureSelector;
