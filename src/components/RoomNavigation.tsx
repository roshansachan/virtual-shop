'use client';

import React, { useRef, useCallback } from 'react';

interface RoomNavigationProps {
  rooms: { id: string; name: string }[];
  selectedRoomId: string;
  onRoomSelect: (roomId: string) => void;
  disablePointerEvents?: boolean;
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

const RoomNavigation: React.FC<RoomNavigationProps> = ({ rooms, selectedRoomId, onRoomSelect, disablePointerEvents }) => {
  console.log('RoomNavigation render', { rooms, selectedRoomId });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndex = rooms.findIndex(room => room.id === selectedRoomId);

  const navigateToPrevious = useCallback(() => {
    const previousIndex = currentIndex === 0 ? rooms.length - 1 : currentIndex - 1;
    onRoomSelect(rooms[previousIndex].id);
  }, [currentIndex, rooms, onRoomSelect]);

  const navigateToNext = useCallback(() => {
    const nextIndex = currentIndex === rooms.length - 1 ? 0 : currentIndex + 1;
    onRoomSelect(rooms[nextIndex].id);
  }, [currentIndex, rooms, onRoomSelect]);

  // Calculate extended rooms array for seamless circular scrolling
  const getExtendedRooms = useCallback(() => {
    const extended = [];
    // Add more rooms for better scrolling experience
    for (let i = -1; i <= 4; i++) {
      const index = (currentIndex + i + rooms.length) % rooms.length;
      extended.push({ room: rooms[index], originalIndex: index });
    }
    return extended;
  }, [currentIndex, rooms]);

  const extendedRooms = rooms.length > 1 ? getExtendedRooms() : rooms.map((room, index) => ({ room, originalIndex: index }));

  // Function to center the active room
  const centerActiveRoom = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const activeElement = container.querySelector(`[data-active="true"]`) as HTMLElement;
      if (activeElement) {
        const containerWidth = container.offsetWidth;
        const elementWidth = activeElement.offsetWidth;
        const elementLeft = activeElement.offsetLeft;
        const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);

        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  // Handle scroll events to recenter on active room
  const handleScroll = useCallback(() => {
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set new timeout to recenter after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      centerActiveRoom();
    }, 150); // Wait 150ms after scroll stops
  }, [centerActiveRoom]);

  // Smooth scroll to center the active room when selectedRoomId changes
  React.useEffect(() => {
    centerActiveRoom();
  }, [selectedRoomId, centerActiveRoom]);

  return (
    <div className={`absolute top-30 left-9 right-9 bg-black/60 rounded-2xl px-4 py-2 ${disablePointerEvents ? 'pointer-events-none' : 'pointer-events-auto'}`}>
      <div className="flex items-center justify-between">
        <button onClick={navigateToPrevious} className="w-3 h-3 text-white z-10 relative">
          <ChevronLeft size={12} />
        </button>

        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onScroll={handleScroll}
        >
          <div className="flex items-center gap-6 px-8">
            {extendedRooms.map(({ room, originalIndex }, index) => (
              <button
                key={`${room.id}-${originalIndex}-${index}`}
                data-active={originalIndex === currentIndex}
                onClick={() => onRoomSelect(room.id)}
                className={`text-xs uppercase whitespace-nowrap transition-all duration-300 snap-center flex-shrink-0 ${
                  originalIndex === currentIndex
                    ? 'text-white font-semibold scale-110'
                    : 'text-white/70 scale-100'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={navigateToNext} className="w-3 h-3 text-white z-10 relative">
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default RoomNavigation;
