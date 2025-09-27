'use client';

import React from 'react';

interface Style {
  name: string;
  color?: string;
}

interface StateCultureSelectorProps {
  styles: Style[];
  selectedStyle: string;
  onStyleSelect: (styleName: string) => void;
}

const StateCultureSelector: React.FC<StateCultureSelectorProps> = ({
  styles,
  selectedStyle,
  onStyleSelect,
}) => {
  return (
    <div className="flex items-center gap-4 px-4 py-3 overflow-x-auto pointer-events-auto">
      {styles.map((style) => (
        <button
          key={style.name}
          onClick={() => onStyleSelect(style.name)}
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
  );
};

export default StateCultureSelector;
