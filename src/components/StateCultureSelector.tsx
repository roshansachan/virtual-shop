'use client';

import React from 'react';

interface Style {
  id: string;
  name: string;
  image: string;
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
    <div className={`flex items-center justify-center gap-4 px-4 py-3 overflow-x-auto pointer-events-auto  ${disablePointerEvents ? 'pointer-events-none' : 'pointer-events-auto'}`}>
      {styles.map((style) => (
        <button
          key={style.id}
          onClick={() => onStyleSelect(style.id)}
          className={`flex items-center gap-2 px-3 py-2 whitespace-nowrap ${
            selectedStyle === style.id
              ? 'border-b-2 border-white'
              : ''
          }`}
        >
          <span className="text-white text-sm">{style.name}</span>
        </button>
      ))}
    </div>
  );
};

export default StateCultureSelector;
