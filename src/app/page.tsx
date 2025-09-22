'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface UploadedImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export default function Home() {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [backgroundImageNaturalSize, setBackgroundImageNaturalSize] = useState({ width: 1920, height: 1080 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Calculate image dimensions and container height
    const img = document.createElement('img');
    img.onload = () => {
      const screenHeight = window.innerHeight;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      
      // Set height to full screen height
      const displayHeight = screenHeight;
      const displayWidth = displayHeight * aspectRatio;
      
      setImageDimensions({ 
        width: displayWidth, 
        height: displayHeight 
      });
      setContainerHeight(screenHeight);
      
      // Store natural dimensions for scaling calculations
      setBackgroundImageNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.src = '/living-room.jpg';
  }, []);

  // Load positioned items from localStorage
  useEffect(() => {
    const loadSavedImages = () => {
      const savedImages = localStorage.getItem('virtualStoreImages');
      if (savedImages) {
        setUploadedImages(JSON.parse(savedImages));
      }
    };

    // Load initial items
    loadSavedImages();

    // Listen for storage changes (when user switches from desktop back to mobile)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'virtualStoreImages') {
        loadSavedImages();
      }
    };

    // Listen for focus events (when user returns to tab)
    const handleFocus = () => {
      loadSavedImages();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Calculate scale factors for positioning items
  const getScaleFactors = () => {
    if (imageDimensions.width === 0 || imageDimensions.height === 0) {
      return { scaleX: 1, scaleY: 1 };
    }
    
    // Desktop uses natural image size (1920x1080), mobile uses scaled size
    const scaleX = imageDimensions.width / backgroundImageNaturalSize.width;
    const scaleY = imageDimensions.height / backgroundImageNaturalSize.height;
    
    return { scaleX, scaleY };
  };

  // Convert desktop coordinates to mobile coordinates
  const convertToMobileCoordinates = (desktopX: number, desktopY: number) => {
    const { scaleX, scaleY } = getScaleFactors();
    return {
      x: desktopX * scaleX,
      y: desktopY * scaleY
    };
  };

  // Calculate scaled image dimensions for overlays
  const getScaledImageDimensions = (originalWidth: number, originalHeight: number) => {
    const { scaleX, scaleY } = getScaleFactors();
    return {
      width: originalWidth * scaleX,
      height: originalHeight * scaleY
    };
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Enhanced smooth scrolling properties
    container.style.scrollBehavior = 'smooth';
    (container.style as any).webkitOverflowScrolling = 'touch';
    container.style.overscrollBehaviorX = 'contain';
    
    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;
    
    // Smooth scroll end detection
    const handleScrollStart = () => {
      isScrolling = true;
      container.style.scrollBehavior = 'auto'; // Disable CSS smooth scroll during touch
    };
    
    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        container.style.scrollBehavior = 'smooth'; // Re-enable smooth scroll
      }, 150);
    };
    
    // Prevent over-scrolling beyond image boundaries
    const handleScroll = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      
      if (container.scrollLeft < 0) {
        container.scrollLeft = 0;
      } else if (container.scrollLeft > maxScrollLeft) {
        container.scrollLeft = maxScrollLeft;
      }
      
      handleScrollEnd();
    };

    // Touch event handlers for better mobile experience
    const handleTouchStart = () => {
      handleScrollStart();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleScrollEnd, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleScrollEnd);
      clearTimeout(scrollTimeout);
    };
  }, [imageDimensions]);

  if (imageDimensions.width === 0 || imageDimensions.height === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" style={{ height: containerHeight }}>
      {/* Horizontal scroll container */}
      <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto overflow-y-hidden smooth-scroll"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollSnapType: 'x proximity',
        }}
      >
        {/* Image container with calculated dimensions */}
        <div 
          className="h-full flex items-center justify-start relative"
          style={{ width: imageDimensions.width }}
        >
          <Image
            src="/living-room.jpg"
            alt="Living Room - Swipe to explore"
            width={Math.round(imageDimensions.width)}
            height={Math.round(imageDimensions.height)}
            className="w-full h-full object-cover select-none"
            priority
            draggable={false}
            style={{
              touchAction: 'pan-x',
              width: imageDimensions.width,
              height: imageDimensions.height,
            }}
          />
          
          {/* Overlay positioned furniture items */}
          {uploadedImages.map((item) => {
            const mobilePosition = convertToMobileCoordinates(item.x, item.y);
            const scaledDimensions = getScaledImageDimensions(item.width, item.height);
            
            return (
              <div
                key={item.id}
                className="absolute pointer-events-none"
                style={{
                  left: mobilePosition.x,
                  top: mobilePosition.y,
                  width: scaledDimensions.width,
                  height: scaledDimensions.height,
                }}
              >
                <img
                  src={item.src}
                  alt={item.name}
                  className="w-full h-full object-contain opacity-80"
                  style={{
                    maxWidth: scaledDimensions.width,
                    maxHeight: scaledDimensions.height,
                  }}
                />
                {/* Optional: Add a subtle indicator */}
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full opacity-70 animate-pulse"></div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
        Swipe to explore →
      </div>
      
      {/* Items indicator */}
      {uploadedImages.length > 0 && (
        <div className="absolute top-16 left-4 bg-blue-600/80 text-white px-3 py-1 rounded-full text-sm">
          {uploadedImages.length} item{uploadedImages.length !== 1 ? 's' : ''} placed
        </div>
      )}
      
      {/* Desktop link */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Link 
          href="/desktop"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Desktop Designer
        </Link>
        
        {uploadedImages.length > 0 && (
          <button
            onClick={() => {
              const savedImages = localStorage.getItem('virtualStoreImages');
              if (savedImages) {
                setUploadedImages(JSON.parse(savedImages));
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Refresh Items
          </button>
        )}
      </div>
    </div>
  );
}
