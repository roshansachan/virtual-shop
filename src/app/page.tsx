'use client';

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SceneRenderer from '@/components/SceneRenderer'

function HomeContent() {
  const searchParams = useSearchParams();
  const sceneParam = searchParams.get('scene');
  const sceneIdParam = searchParams.get('sceneId');

  return (
    <div className="relative w-full h-screen">
      <SceneRenderer 
        sceneId={sceneIdParam || undefined}
        sceneIndex={sceneParam ? parseInt(sceneParam) : undefined}
      />
      
      {/* Design Studio link */}
      <div className="absolute top-4 right-4 z-30">
        <Link 
          href={sceneIdParam ? `/design-studio?sceneId=${sceneIdParam}` : "/design-studio"}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg"
        >
          Design Studio
        </Link>
      </div>
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
    </Suspense>
  );
}
