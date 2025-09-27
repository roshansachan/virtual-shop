'use client';

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
// import Link from 'next/link'
import SpaceRenderer from '@/components/SpaceRenderer'
import StaticHUD from '@/components/StaticHUD'

function HomeContent() {
  const searchParams = useSearchParams();
  const spaceIdParam = searchParams.get('spaceId');
  const [defaultSpaceId, setDefaultSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!spaceIdParam);

  // Fetch default space if no spaceId in URL
  useEffect(() => {
    if (spaceIdParam) return;

    const fetchDefaultSpace = async () => {
      try {
        const response = await fetch('/api/spaces');
        if (!response.ok) throw new Error('Failed to fetch spaces');
        
        const data = await response.json();
        if (data.success && data.data.length > 0) {
          setDefaultSpaceId(data.data[0].id.toString());
        }
      } catch (error) {
        console.error('Error fetching default space:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDefaultSpace();
  }, [spaceIdParam]);

  const spaceId = spaceIdParam || defaultSpaceId || undefined;

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading space...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <SpaceRenderer 
        hideIndicators
        spaceId={spaceId}
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
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
      <StaticHUD />
    </Suspense>
  );
}
