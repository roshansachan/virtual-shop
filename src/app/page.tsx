'use client';

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
// import Link from 'next/link'
import SpaceRenderer from '@/components/SpaceRenderer'
import StaticHUD from '@/components/StaticHUD'

interface HomeContentProps {
  selectedSpace: number | null;
  onSelectedSpaceChange: (spaceId: number | null) => void;
}

function HomeContent({ selectedSpace, onSelectedSpaceChange }: HomeContentProps) {
  const searchParams = useSearchParams();
  const spaceIdParam = searchParams.get('spaceId');

  // Initialize selectedSpace from query param on mount
  useEffect(() => {
    if (spaceIdParam && !selectedSpace) {
      const spaceId = parseInt(spaceIdParam, 10);
      if (!isNaN(spaceId)) {
        onSelectedSpaceChange(spaceId);
      }
    }
  }, [spaceIdParam, selectedSpace, onSelectedSpaceChange]);

  return (
    <div className="relative w-full h-screen">
      <SpaceRenderer 
        hideIndicators
        spaceId={selectedSpace?.toString()}
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
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null);
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent 
        selectedSpace={selectedSpace}
        onSelectedSpaceChange={setSelectedSpace}
      />
      <StaticHUD 
        selectedSpace={selectedSpace}
        onSelectedSpaceChange={setSelectedSpace}
      />
    </Suspense>
  );
}
