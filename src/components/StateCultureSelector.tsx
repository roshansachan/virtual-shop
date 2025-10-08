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
    <div className={`flex items-end justify-start w-full gap-4 px-4 py-3 overflow-x-auto  ${disablePointerEvents ? 'pointer-events-none' : 'pointer-events-auto'}`}>
      {styles.map((style) => (
        <button
          key={style.id}
          onClick={() => onStyleSelect(style.id)}
          className={`flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
            selectedStyle === style.id
              ? 'border-b-1 border-white pb-1'
              : ''
          }`}
        >
          {style.themeImage ? (
            <img
              src={style.themeImage}
              alt={style.name}
              className={`h-[16px] w-auto object-contain ${
                selectedStyle === style.id
                  ? 'scale-110'
                  : ''
              }`}
            />
          ) : (
            <span className="text-white text-sm px-3 py-2">{style.name}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default StateCultureSelector;
