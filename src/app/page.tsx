'use client';

import { Suspense, useEffect, useState, useCallback } from 'react'
// import { useSearchParams } from 'next/navigation'
// import Link from 'next/link'
import SpaceRenderer from '@/components/SpaceRenderer'
import StaticHUD from '@/components/StaticHUD'

interface HomeContentProps {
  selectedSpace: string | null;
  handleSelectedSpaceChange?: (spaceId: string | null) => void;
}

function HomeContent({ selectedSpace, handleSelectedSpaceChange }: HomeContentProps) {
  // const searchParams = useSearchParams();
  // const spaceIdParam = searchParams.get('spaceId');
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [firstRenderCompleted, setFirstRenderCompleted] = useState(false);

  // Handle dynamic viewport height for mobile browsers
  useEffect(() => {
    const updateViewportHeight = () => {
      // Use visualViewport if available (more accurate on mobile), fallback to innerHeight
      const vh = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`)
    }

    updateViewportHeight()
    
    // Listen for viewport changes (address bar show/hide on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight)
      return () => window.visualViewport?.removeEventListener('resize', updateViewportHeight)
    } else {
      window.addEventListener('resize', updateViewportHeight)
      return () => window.removeEventListener('resize', updateViewportHeight)
    }
  }, [])

  const handleDrawerStateChange = useCallback((isOpen: boolean) => {
    setIsProductDrawerOpen(isOpen);
  }, []);

  const handleFirstRenderCompleted = useCallback(() => {
    setFirstRenderCompleted(true);
  }, []);

  return (
    <div className="relative w-full" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <SpaceRenderer 
        hideIndicators
        spaceId={selectedSpace}
        onDrawerStateChange={handleDrawerStateChange}
        onFirstRenderCompleted={handleFirstRenderCompleted}
      />

      <StaticHUD 
        selectedSpace={selectedSpace}
        onSelectedSpaceChange={handleSelectedSpaceChange}
        isProductDrawerOpen={isProductDrawerOpen}
        firstRenderCompleted={firstRenderCompleted}
      />
      
      {/* Design Studio link */}
      {/* <div className="absolute top-4 right-4 z-30">
        <Link 
          href={sceneIdParam ? `/design-studio?sceneId=${sceneIdParam}` : "/design-studio"}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
        >
          Design Studio
        </Link>
      </div> */}
    </div>
  );
}

export default function Home() {
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  
  const handleSelectedSpaceChange = useCallback((spaceId: string | null) => {
    setSelectedSpace(spaceId);
  }, []);

  return (
    <Suspense fallback={
      <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent 
        selectedSpace={selectedSpace}
        handleSelectedSpaceChange={handleSelectedSpaceChange}
      />
    </Suspense>
  );
}
