'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import StaticHeader from './StaticHeader';
import RoomNavigation from './RoomNavigation';
import HomeStyleSelector from './HomeStyleSelector';
import StateCultureSelector from './StateCultureSelector';

interface StaticHUDProps {
  onClose?: () => void;
  selectedSpace?: string | null;
  onSelectedSpaceChange?: (spaceId: string | null) => void;
}

interface Scene {
  id: string;
  name: string;
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  backgroundImageS3Key?: string;
  themeId?: number;
  themeIcon?: string;
  dbId?: string;
  type?: 'home' | 'street';
  spaces: Space[];
}

interface Space {
  id: string;
  scene_id: number;
  name: string;
  image?: string;
  created_at: string;
  updated_at: string;
}

const StreetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="0 0 13 12" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M4.25509 1.8072C4.45909 1.8468 4.59109 2.0442 4.55089 2.247L3.05089 9.897C3.02896 9.99174 2.97109 10.0742 2.88949 10.1271C2.80788 10.18 2.70893 10.1991 2.61351 10.1804C2.51808 10.1618 2.43364 10.1067 2.378 10.027C2.32236 9.94725 2.29988 9.84901 2.31529 9.753L3.81529 2.103C3.83444 2.00549 3.89151 1.91956 3.97398 1.86409C4.05644 1.80863 4.15755 1.78817 4.25509 1.8072ZM6.28309 1.8C6.57289 1.8 6.80809 2.0352 6.80809 2.325V3.3C6.80809 3.43924 6.75277 3.57278 6.65432 3.67123C6.55586 3.76969 6.42233 3.825 6.28309 3.825C6.14385 3.825 6.01031 3.76969 5.91186 3.67123C5.8134 3.57278 5.75809 3.43924 5.75809 3.3V2.325C5.75809 2.0352 5.99329 1.8 6.28309 1.8ZM6.80809 8.7C6.80809 8.56077 6.75277 8.42723 6.65432 8.32877C6.55586 8.23032 6.42233 8.175 6.28309 8.175C6.14385 8.175 6.01031 8.23032 5.91186 8.32877C5.8134 8.42723 5.75809 8.56077 5.75809 8.7V9.675C5.75809 9.81424 5.8134 9.94778 5.91186 10.0462C6.01031 10.1447 6.14385 10.2 6.28309 10.2C6.42233 10.2 6.55586 10.1447 6.65432 10.0462C6.75277 9.94778 6.80809 9.81424 6.80809 9.675V8.7ZM6.28309 4.9878C6.57289 4.9878 6.80809 5.2224 6.80809 5.5128V6.4878C6.80809 6.62704 6.75277 6.76058 6.65432 6.85904C6.55586 6.95749 6.42233 7.0128 6.28309 7.0128C6.14385 7.0128 6.01031 6.95749 5.91186 6.85904C5.8134 6.76058 5.75809 6.62704 5.75809 6.4878V5.5128C5.75809 5.2224 5.99329 4.9878 6.28309 4.9878ZM8.75089 2.103C8.74291 2.05332 8.72502 2.00574 8.69827 1.96311C8.67152 1.92049 8.63647 1.88368 8.5952 1.85488C8.55392 1.82609 8.50728 1.8059 8.45804 1.79551C8.4088 1.78512 8.35797 1.78475 8.30858 1.79441C8.2592 1.80408 8.21226 1.82359 8.17057 1.85178C8.12888 1.87997 8.0933 1.91626 8.06593 1.95849C8.03856 2.00072 8.01997 2.04803 8.01127 2.0976C8.00257 2.14717 8.00394 2.19798 8.01529 2.247L9.51529 9.897C9.52326 9.94669 9.54116 9.99427 9.5679 10.0369C9.59465 10.0795 9.62971 10.1163 9.67098 10.1451C9.71225 10.1739 9.7589 10.1941 9.80814 10.2045C9.85738 10.2149 9.9082 10.2153 9.95759 10.2056C10.007 10.1959 10.0539 10.1764 10.0956 10.1482C10.1373 10.12 10.1729 10.0837 10.2002 10.0415C10.2276 9.99928 10.2462 9.95197 10.2549 9.90241C10.2636 9.85284 10.2622 9.80203 10.2509 9.753L8.75089 2.103Z" fill="#333333"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="10" viewBox="0 0 12 8" fill="none">
    <path d="M7.49662 3.3519L4.52519 0.494833C4.38588 0.360929 4.19697 0.285706 3.99999 0.285706C3.80301 0.285706 3.6141 0.360929 3.47479 0.494833L0.503366 3.3519C0.434105 3.41808 0.3792 3.49684 0.341837 3.58358C0.304474 3.67033 0.285396 3.76335 0.285709 3.85724V7.28572C0.285709 7.39938 0.332668 7.50838 0.416256 7.58875C0.499844 7.66912 0.613213 7.71428 0.731423 7.71428H7.26856C7.38677 7.71428 7.50014 7.66912 7.58373 7.58875C7.66731 7.50838 7.71427 7.39938 7.71427 7.28572V3.85724C7.71459 3.76335 7.69551 3.67033 7.65815 3.58358C7.62078 3.49684 7.56588 3.41808 7.49662 3.3519ZM6.82285 6.85716H1.17714V3.91617L3.99999 1.20196L6.82285 3.91617V6.85716Z" fill="#333333"/>
  </svg>
);

const StaticHUD: React.FC<StaticHUDProps> = ({ selectedSpace, onSelectedSpaceChange }) => {
  const searchParams = useSearchParams();
  const [selectedSceneType, setSelectedSceneType] = useState<'home' | 'street'>(() => {
    const sceneType = searchParams.get('sceneType');
    return sceneType === 'street' ? 'street' : 'home';
  });
  const [allScenes, setAllScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [isHudVisible, setIsHudVisible] = useState(true);

  // Refs for idle timer
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Functions for HUD visibility management
  const showHud = useCallback(() => {
    setIsHudVisible(true);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsHudVisible(false);
    }, 5000); // 5 seconds of inactivity
  }, []);

  const handleClick = useCallback(() => {
    if (showLeftPanel) {
      // Don't hide HUD when left panel is open
      return;
    }
    if (isHudVisible) {
      // If HUD is visible, hide it and clear the timer
      setIsHudVisible(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    } else {
      // If HUD is hidden, show it and start the timer
      showHud();
    }
  }, [isHudVisible, showHud, showLeftPanel]);

  // Set up idle timer on mount
  useEffect(() => {
    showHud(); // Start with HUD visible

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [showHud]);

  // Manage idle timer based on showLeftPanel
  useEffect(() => {
    if (showLeftPanel) {
      // Clear the timer when left panel is open
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    } else if (isHudVisible) {
      // Restart the timer when panel is closed and HUD is visible
      showHud();
    }
  }, [showLeftPanel, isHudVisible, showHud]);

  // Set up click event listeners
  useEffect(() => {
    const handleClickEvent = (e: MouseEvent) => {
      // Only toggle HUD when clicking on scene background or product images
      if (e.target instanceof Element && (e.target.closest('.scene-bg-image') || e.target.closest('.scene-product-image'))) {
        handleClick();
      }
    };

    document.addEventListener('click', handleClickEvent, { passive: true });

    return () => {
      document.removeEventListener('click', handleClickEvent);
    };
  }, [handleClick]);

  // Fetch all scenes on component mount
  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const response = await fetch('/api/scenes');
        const result = await response.json();
        if (result.success) {
          setAllScenes(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch scenes:', error);
      }
    };

    fetchScenes();
  }, []);

  // Set scenes on scene type changes
  useEffect(() => {
    if (allScenes.length && selectedSceneType && !selectedScene) {
      const filteredScenes = allScenes.filter(scene => scene.type === selectedSceneType);
      setSelectedScene(filteredScenes.length > 0 ? filteredScenes[0] : null);
    }
  }, [allScenes, selectedScene, selectedSceneType]);

  // Fetch spaces when selected scene changes
  useEffect(() => {
    if (selectedScene) {
      setSpaces(selectedScene.spaces);
    }
  }, [selectedScene]);

  // Set selectedSpace when spaces change
  useEffect(() => {
    if (selectedScene) {
      onSelectedSpaceChange?.(selectedScene.spaces.length > 0 ? selectedScene.spaces[0].id : null);
    }
  }, [onSelectedSpaceChange, selectedScene, selectedScene?.spaces]);

  // Handle selected space validation and updates when spaces change
  useEffect(() => {
    if (spaces.length === 0) return;

    let selectedSpaceId: string | null = null;

    // First, check if current selectedSpace is still valid
    if (selectedSpace && spaces.some((s: Space) => s.id === selectedSpace)) {
      selectedSpaceId = selectedSpace;
    } else {
      // If not valid, check URL params
      const spaceIdFromUrl = searchParams.get('spaceId');
      if (spaceIdFromUrl && spaces.some((s: Space) => s.id === spaceIdFromUrl)) {
        selectedSpaceId = spaceIdFromUrl;
      } else if (spaces.length > 0) {
        // Default to first space if nothing else is valid
        selectedSpaceId = spaces[0].id;
      }
    }

    // Only call the callback if we actually need to change the selected space
    if (selectedSpaceId !== selectedSpace) {
      onSelectedSpaceChange?.(selectedSpaceId);
    }
  }, [spaces, selectedSpace, searchParams, onSelectedSpaceChange]);

  const handleHomeSceneSelect = (scene: Scene) => {
    setSelectedSceneType('home');
    setSelectedScene(scene);
    setShowLeftPanel(false); // Close the panel when selecting a scene
  };

  const handleStreetSceneSelect = (scene: Scene) => {
    setSelectedSceneType('street');
    setSelectedScene(scene);
    setShowLeftPanel(false); // Close the panel when selecting a scene
  };

  // Transform scenes for HomeStyleSelector
  const homeStyles = allScenes.filter(scene => scene.type === 'home').map(scene => ({
    id: scene.id,
    name: scene.name,
    image: scene.backgroundImage
  }));

  // Transform scenes for StateCultureSelector
  const streetStyles = allScenes.filter(scene => scene.type === 'street').map(scene => ({
    id: scene.id,
    name: scene.name,
    image: scene.backgroundImage,
    themeImage: scene.themeIcon,
  }));

  // Transform spaces for RoomNavigation
  const rooms = spaces.map(space => ({ id: space.id, name: space.name }));

  const handleRoomSelect = (roomId: string) => {
    onSelectedSpaceChange?.(roomId);
  };

  return (
    <div className={`fixed inset-0 z-20 pointer-events-none font-belleza transition-opacity duration-300 ${isHudVisible ? 'opacity-100' : 'opacity-0'}`} data-hud>
      {/* Top Header */}
      <div className={`absolute left-0 right-0 bg-gradient-to-b from-black to-transparent px-6 py-4 pointer-events-auto transition-all duration-300 ease-in-out ${
        (showLeftPanel || !isHudVisible) ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      }`}>
        <StaticHeader />

        {/* Street View Button */}
        <div className="flex justify-end">
          <button 
            className={`bg-white text-gray-800 px-4 py-2 rounded-[12px] text-xs font-semibold flex items-center gap-0 ${!isHudVisible ? 'pointer-events-none' : 'pointer-events-auto'}`}
            onClick={() => {
              setSelectedScene(null); // Reset selected scene to pick a new one of the new type
              setSelectedSceneType(selectedSceneType === 'home' ? 'street' : 'home');
            }}
          >
            {selectedSceneType === 'home' ? <>
              <StreetIcon />
              STREET VIEW
            </> : <>
              <HomeIcon />
              HOME VIEW
            </>}
          </button>
        </div>
      </div>

      {/* Room Navigation */}
      {selectedSceneType === 'home' && (
        <div className={`transition-all duration-300 ease-in-out ${
          showLeftPanel ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <RoomNavigation
            rooms={rooms}
            selectedRoomId={selectedSpace || ''}
            onRoomSelect={handleRoomSelect}
            disablePointerEvents={showLeftPanel || !isHudVisible}
          />
        </div>
      )}

      <HomeStyleSelector
        styles={homeStyles}
        selectedStyle={selectedScene?.id || ''}
        onStyleSelect={(sceneId) => {
          const scene = allScenes.find(s => s.id === sceneId);
          if (scene) handleHomeSceneSelect(scene);
        }}
        showLeftPanel={showLeftPanel}
        onTogglePanel={() => setShowLeftPanel(!showLeftPanel)}
        disablePointerEvents={!isHudVisible}
      />

      {/* Style Selector Bar */}
      {selectedSceneType === 'street' && (
        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-in-out ${
          showLeftPanel ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}>
          <StateCultureSelector
            styles={streetStyles}
            selectedStyle={selectedScene?.id || ''}
            onStyleSelect={(sceneId) => {
              const scene = allScenes.find(s => s.id === sceneId);
              if (scene) handleStreetSceneSelect(scene);
            }}
            disablePointerEvents={showLeftPanel || !isHudVisible}
          />
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/64 to-transparent pointer-events-auto" />
    </div>
  );
};

export default StaticHUD;
