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
  folderName?: string;
}

interface FolderImage {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  visible: boolean;
}

interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  images: FolderImage[];
}

export default function Home() {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [containerHeight, setContainerHeight] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [backgroundImageNaturalSize, setBackgroundImageNaturalSize] = useState({ width: 1920, height: 1080 });
  const [selectedItem, setSelectedItem] = useState<UploadedImage | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [folderImages, setFolderImages] = useState<UploadedImage[]>([]);
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

  // Handle hot-spot click
  const handleHotSpotClick = (item: UploadedImage) => {
    setSelectedItem(item);
    
    // Load folder data from localStorage
    const savedFolderData = localStorage.getItem('virtualStoreFolders');
    if (savedFolderData && item.folderName) {
      const folderData = JSON.parse(savedFolderData);
      const folder = folderData.folders?.find((f: Folder) => f.name === item.folderName);
      
      if (folder) {
        // Convert folder images to UploadedImage format for display
        const folderImagesForDisplay = folder.images.map((img: FolderImage) => ({
          id: img.id,
          src: img.src,
          name: img.name,
          width: img.width,
          height: img.height,
          x: 0,
          y: 0,
          folderName: folder.name
        }));
        setFolderImages(folderImagesForDisplay);
      } else {
        // Fallback: just show the current item
        setFolderImages([item]);
      }
    } else {
      // Fallback: just show the current item
      setFolderImages([item]);
    }
    
    setShowDrawer(true);
  };

  // Close drawer
  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedItem(null);
    setFolderImages([]);
  };

  // Handle try-on functionality
  const handleTryOn = (imageToTryOn: UploadedImage) => {
    if (!selectedItem) return;

    // Create a new product overlay with the same position as the selected item
    const newItem: UploadedImage = {
      ...imageToTryOn,
      x: selectedItem.x,
      y: selectedItem.y,
      id: selectedItem.id // Keep the same ID to replace in the same position
    };

    // Update the uploaded images array
    const updatedImages = uploadedImages.map(item => 
      item.id === selectedItem.id ? newItem : item
    );

    setUploadedImages(updatedImages);

    // Update localStorage
    localStorage.setItem('virtualStoreImages', JSON.stringify(updatedImages));

    // Close the drawer
    closeDrawer();
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Enhanced smooth scrolling properties
    container.style.scrollBehavior = 'smooth';
    (container.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';
    container.style.overscrollBehaviorX = 'contain';
    
    let scrollTimeout: NodeJS.Timeout;
    
    // Smooth scroll end detection
    const handleScrollStart = () => {
      container.style.scrollBehavior = 'auto'; // Disable CSS smooth scroll during touch
    };
    
    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
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
                className="absolute"
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
                  className="w-full h-full object-contain opacity-80 pointer-events-none"
                  style={{
                    maxWidth: scaledDimensions.width,
                    maxHeight: scaledDimensions.height,
                  }}
                />
                {/* Hot-spot indicator */}
                <button
                  onClick={() => handleHotSpotClick(item)}
                  className="absolute -top-2 -left-2 w-8 h-8 cursor-pointer hover:scale-110 transition-transform z-30"
                  aria-label={`View details for ${item.name}`}
                >
                  <Image
                    src="/hot-spot.svg"
                    alt="View details"
                    width={32}
                    height={32}
                    className="w-full h-full"
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Scroll indicator */}
      
      
      {/* Items indicator */}
      {uploadedImages.length > 0 && (
        <div className="absolute top-16 left-4 bg-blue-600/80 text-white px-3 py-1 rounded-full text-sm">
          {uploadedImages.length} item{uploadedImages.length !== 1 ? 's' : ''} placed
        </div>
      )}
      
      {/* Design Studio link */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <Link 
          href="/design-studio"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Design Studio
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

      {/* Bottom Drawer */}
      {showDrawer && selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl shadow-lg max-h-[80vh] flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Related Items</h2>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Gallery */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {folderImages.map((image, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="aspect-square relative bg-gray-100">
                      <img
                        src={image.src}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm mb-2 truncate">{image.name}</h3>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleTryOn(image)}
                          className="w-full bg-black text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                          Try On
                        </button>
                        <div className="flex space-x-2">
                          <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            Details
                          </button>
                          <button className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                            Buy Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
