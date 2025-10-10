'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { captureCanvasForFullscreen } from '@/lib/fullscreen-utils'
// import ProductSelectionDrawer from './ProductSelectionDrawer'
import ProductSwipeDrawer from './ProductSwipeDrawer'
import StoriesModal from './StoriesModal'
import type { SpaceConfig } from '@/types/index'

// Types for the space-based configuration
interface ProductImage {
  id: string
  name: string
  src: string
  s3Key: string
  visible: boolean
  width: number
  height: number
  x: number
  y: number
}

interface Placement {
  id: string
  name: string
  art_story_id?: number | null
  expanded: boolean
  visible: boolean
  products: ProductImage[]
}

interface SpaceRendererProps {
  spaceId: string | null;
  hideIndicators?: boolean
}

export default function SpaceRenderer({ spaceId, hideIndicators = false }: SpaceRendererProps) {
  const [space, setSpace] = useState<SpaceConfig | null>(null)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [artStoryData, setArtStoryData] = useState<any>(null)
  const [artStoryLoading, setArtStoryLoading] = useState(false)
  const [showStoriesModal, setShowStoriesModal] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [fullscreenImageSrc, setFullscreenImageSrc] = useState<string | null>(null)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [shouldTransition, setShouldTransition] = useState(false)
  const prevShowDrawerRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Common transition style for easy customization
  const TRANSITION_STYLE = '0.5s ease-out'

  /**
   * Gets the actual dimensions of an image by loading it
   */
  const getImageDimensions = useCallback((src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = reject
      img.src = src
    })
  }, [])

  /**
   * Gets actual dimensions for all product images in placements
   */
  const getAllProductDimensions = useCallback(async (placements: Placement[]): Promise<void> => {
    const dimensionPromises = placements.flatMap(placement =>
      placement.products.map(async (product) => {
        try {
          const actualDimensions = await getImageDimensions(product.src)
          product.width = actualDimensions.width
          product.height = actualDimensions.height
          console.log(`Actual dimensions for ${product.name}:`, actualDimensions)
        } catch (error) {
          console.error(`Failed to get dimensions for ${product.name}:`, error)
          // Keep existing dimensions if loading fails
        }
      })
    )
    await Promise.all(dimensionPromises)
  }, [getImageDimensions])

  /**
   * Loads space configuration from the database API and gets actual image dimensions
   */
  const loadSpace = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!spaceId) {
        setLoading(false)
        return
      }

      console.log('Fetching space data for spaceId:', spaceId);

      const response = await fetch(`/api/spaces/${spaceId}`);
      if (!response.ok) {
        throw new Error(`Failed to load space: ${response.status}`)
      }

      const spaceDataRes = await response.json()
      console.log('Space Data:', spaceDataRes);

      const spaceData = spaceDataRes.data

      // Get actual background image dimensions
      if (spaceData.backgroundImage || spaceData.image) {
        const backgroundSrc = spaceData.backgroundImage || spaceData.image
        try {
          const actualDimensions = await getImageDimensions(backgroundSrc)
          spaceData.backgroundImageSize = actualDimensions
          console.log('Actual background image dimensions:', actualDimensions)
        } catch (error) {
          console.error('Failed to get background image dimensions:', error)
          // Keep existing dimensions if available, or use defaults
          if (!spaceData.backgroundImageSize) {
            spaceData.backgroundImageSize = { width: 1920, height: 1080 }
          }
        }
      }

      // Get actual dimensions for all product images
      if (spaceData.placements && spaceData.placements.length > 0) {
        await getAllProductDimensions(spaceData.placements)
      }

      setSpace(spaceData)
    } catch (err) {
      console.error('Error loading space:', err)
      setError(err instanceof Error ? err.message : 'Failed to load space')
    } finally {
      setLoading(false)
    }
  }, [spaceId, getImageDimensions, getAllProductDimensions])

  /**
   * Calculates the scaling factor based on background dimensions and viewport
   */
  const calculateScale = useCallback((bgWidth: number, bgHeight: number, availableHeight?: number): number => {
    const viewportWidth = window.innerWidth
    const viewportHeight = availableHeight || window.innerHeight

    // Calculate scale factors for both dimensions
    const scaleX = viewportWidth / bgWidth
    const scaleY = viewportHeight / bgHeight

    // If background is larger than viewport in both dimensions, keep original size (scale = 1)
    // This allows scrolling instead of scaling down
    // if (bgWidth > viewportWidth && bgHeight > viewportHeight) {
    //   return 1
    // }

    // If background is smaller than viewport, scale up to cover the viewport
    // Use the larger scale factor to ensure the image covers the entire viewport
    const scale = Math.max(scaleX, scaleY)
    
    return scale
  }, [])

  /**
   * Gets the visible product from a placement (only one product per placement is shown)
   */
  const getVisibleImage = useCallback((placement: Placement): ProductImage | null => {
    return placement.products.find(product => product.visible) || placement.products[0] || null
  }, [])

  /**
   * Gets all visible products across all placements for rendering
   */
  const getVisibleImages = (): ProductImage[] => {
    if (!space) return []

    return space.placements
      .filter((placement: Placement) => placement.visible)
      .map((placement: Placement) => getVisibleImage(placement))
      .filter((product): product is ProductImage => product !== null)
  }

  /**
   * Creates a hotspot element with pulsing animation
   */
  const createHotspot = (image: ProductImage, placement: Placement) => {
    const hotspotSize = 24
    const scaledX = image.x * scale
    const scaledY = image.y * scale
    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    
    const hotspotX = scaledX + scaledWidth / 2 - hotspotSize / 2
    const hotspotY = scaledY + scaledHeight / 2 - hotspotSize / 2

    return (
      <div
        key={`hotspot-${image.id}`}
        className="absolute z-20 w-12 h-12 cursor-pointer"
        data-hotspot="true"
        style={{
          left: `${hotspotX - 12}px`,
          top: `${hotspotY - 12}px`,
          ...(shouldTransition && { transition: `left ${TRANSITION_STYLE}, top ${TRANSITION_STYLE}` })
        }}
        onClick={() => handleHotspotClick(placement)}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${hotspotSize}px`,
            height: `${hotspotSize}px`,
          }}
        >
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-75" />
          
          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>
      </div>
    )
  }

  /**
   * Fetches art stories for a specific placement
   */
  const fetchArtStoriesForPlacement = useCallback(async (artStoryId: number) => {
    try {
      setArtStoryLoading(true);
      console.log('Fetching art stories for art_story_id:', artStoryId);
      const response = await fetch(`/api/art-stories/${artStoryId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('Art stories response:', data.data);
        setArtStoryData(data.data);
        return data.data;
      } else {
        console.error('Failed to fetch art stories:', data.error);
        setArtStoryData(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching art stories:', error);
      setArtStoryData(null);
      return null;
    } finally {
      setArtStoryLoading(false);
    }
  }, []);

  /**
   * Handles story icon click to open stories modal
   */
  const handleStoryIconClick = useCallback(() => {
    if (artStoryData) {
      setShowStoriesModal(true);
    }
  }, [artStoryData]);

  /**
   * Handles deletion of a placement
   */
  const handleDeletePlacement = useCallback(async (placementId: string) => {
    try {
      const response = await fetch(`/api/placements/${placementId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete placement');
      }
      
      const result = await response.json();
      console.log('Placement deleted:', result);
      
      // Refresh space data to reflect the deletion
      if (spaceId) {
        await loadSpace();
      }
    } catch (error) {
      console.error('Error deleting placement:', error);
      throw error;
    }
  }, [spaceId]);

  /**
   * Handles deletion of a product/placement image
   */
  const handleDeleteProduct = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/placement-images/${productId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
      
      const result = await response.json();
      console.log('Product deleted:', result);
      
      // Refresh space data to reflect the deletion
      if (spaceId) {
        await loadSpace();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }, [spaceId]);

  /**
   * Scrolls the container to center the visible product from a placement after scaling transition
   */
  const scrollToProduct = useCallback((placement: Placement, drawerWillBeOpen: boolean) => {
    setTimeout(() => {
      const visibleProduct = getVisibleImage(placement)
      if (visibleProduct && scrollContainerRef.current && space?.backgroundImageSize) {
        const container = scrollContainerRef.current
        
        // Calculate the scale that will be used after the transition
        const targetAvailableHeight = drawerWillBeOpen ? window.innerHeight * 0.70 : undefined
        const targetScale = calculateScale(
          space.backgroundImageSize.width,
          space.backgroundImageSize.height,
          targetAvailableHeight
        )
        
        const productCenterX = visibleProduct.x * targetScale + (visibleProduct.width * targetScale) / 2
        const productCenterY = visibleProduct.y * targetScale + (visibleProduct.height * targetScale) / 2
        
        // Calculate the scroll position to center the product in the viewport
        const viewportWidth = container.clientWidth
        const viewportHeight = container.clientHeight
        const scrollLeft = Math.max(0, productCenterX - viewportWidth / 2)
        const scrollTop = Math.max(0, productCenterY - viewportHeight / 2)
        
        container.scrollTo({
          left: scrollLeft,
          top: scrollTop,
          behavior: 'smooth'
        })
      }
    }, 500) // Wait for the scaling transition to complete (0.5s)
  }, [space, calculateScale, getVisibleImage])

  /**
   * Handles hotspot click to show placement options
   */
  const handleHotspotClick = async (placement: Placement) => {
    console.log('Hotspot clicked for placement:', placement.name, 'with art_story_id:', placement.art_story_id);
    
    // Open drawer immediately
    setSelectedPlacement(placement)
    setShowDrawer(true)
    
    // Fetch art stories asynchronously if the placement has an art_story_id
    if (placement.art_story_id) {
      fetchArtStoriesForPlacement(placement.art_story_id);
    } else {
      console.log('No art_story_id found for this placement');
      setArtStoryData(null);
    }

    // After the scaling transition completes, scroll the clicked product into view
    scrollToProduct(placement, true) // true = drawer will be open
  }

  /**
   * Handles fullscreen mode - captures image and enters native browser fullscreen
   */
  const handleFullscreen = async () => {
    try {
      // First capture the canvas as data:image
      const imageDataUrl = captureCanvasForFullscreen(
        undefined, // No Konva stage in SpaceRenderer
        containerRef,
        scaledWidth,
        scaledHeight
      );

      if (imageDataUrl) {
        setFullscreenImageSrc(imageDataUrl);
        setShowFullscreen(true);
        
        // Wait for the modal to render, then trigger native fullscreen
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const modal = document.querySelector('.fullscreen-container') as HTMLElement;
          if (modal && modal.requestFullscreen) {
            await modal.requestFullscreen();
            setIsNativeFullscreen(true);
          }
        } catch (error) {
          console.log('Native fullscreen not available, staying in modal:', error);
          // Modal is already open, so user can still view fullscreen content
        }
      } else {
        console.error('Failed to capture canvas for fullscreen');
      }
    } catch (error) {
      console.error('Error capturing fullscreen:', error);
    }
  }

  /**
   * Handles exiting fullscreen mode
   */
  const handleExitFullscreen = async () => {
    try {
      if (isNativeFullscreen && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    } finally {
      // Always reset states regardless of native fullscreen success
      setShowFullscreen(false);
      setFullscreenImageSrc(null);
      setIsNativeFullscreen(false);
    }
  }

  /**
   * Handles product switching within a placement
   */
  const handleImageSwitch = (newImage: ProductImage) => {
    if (!space || !selectedPlacement) return

    // Update the space state to show the new product
    const updatedSpace = {
      ...space,
      placements: space.placements.map((placement: Placement) => {
        if (placement.id === selectedPlacement.id) {
          return {
            ...placement,
            products: placement.products.map((product: ProductImage) => ({
              ...product,
              visible: product.id === newImage.id
            }))
          }
        }
        return placement
      })
    }

    setSpace(updatedSpace)
    setSelectedPlacement(updatedSpace.placements.find((p: Placement) => p.id === selectedPlacement.id) || null)
    // closeDrawer()
  }

  /**
   * Closes the drawer
   */
  const closeDrawer = () => {
    // Store the current placement to scroll to it after the transition
    const placementToScroll = selectedPlacement
    
    setShowDrawer(false)
    setSelectedPlacement(null)
    
    // After the scaling transition completes, scroll the product into view
    if (placementToScroll) {
      scrollToProduct(placementToScroll, false) // false = drawer will be closed
    }
  }

  // Load space on mount or when props change
  useEffect(() => {
    loadSpace()
  }, [spaceId, loadSpace])

  // Update scaling when space loads or window resizes
  useEffect(() => {
    if (!space || !space.backgroundImageSize) return

    const updateScale = () => {
      const availableHeight = showDrawer ? window.innerHeight * 0.70 : undefined
      const newScale = calculateScale(
        space.backgroundImageSize!.width,
        space.backgroundImageSize!.height,
        availableHeight
      )
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [space, showDrawer, calculateScale])

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

  // Prevent pinch-to-zoom gestures (allow zoom in fullscreen)
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      // Allow zoom in fullscreen mode
      if (showFullscreen) return;

      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchstart', preventZoom, { passive: false })
    document.addEventListener('touchmove', preventZoom, { passive: false })

    return () => {
      document.removeEventListener('touchstart', preventZoom)
      document.removeEventListener('touchmove', preventZoom)
    }
  }, [showFullscreen])

  // Listen for native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isNativeFullscreen) {
        // User exited fullscreen using browser controls (ESC key, etc.)
        setShowFullscreen(false);
        setIsNativeFullscreen(false);
        setFullscreenImageSrc(null);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }
  }, [isNativeFullscreen])

  // Enhanced smooth scrolling
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || showDrawer) return

    container.style.scrollBehavior = 'smooth'
    // @ts-expect-error - WebKit specific property for smooth scrolling
    container.style.webkitOverflowScrolling = 'touch'
    container.style.overscrollBehavior = 'none'
    
    let scrollTimeout: NodeJS.Timeout
    
    const handleScrollStart = () => {
      container.style.scrollBehavior = 'auto'
    }
    
    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        container.style.scrollBehavior = 'smooth'
      }, 150)
    }
    
    const handleScroll = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth
      
      if (container.scrollLeft < 0) {
        container.scrollLeft = 0
      } else if (container.scrollLeft > maxScrollLeft) {
        container.scrollLeft = maxScrollLeft
      }
      
      handleScrollEnd()
    }

    const handleTouchStart = () => {
      handleScrollStart()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleScrollEnd, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleScrollEnd)
      clearTimeout(scrollTimeout)
    }
  }, [space, showDrawer])

  // Track drawer state changes to enable transitions only during drawer open/close
  useEffect(() => {
    if (prevShowDrawerRef.current !== showDrawer) {
      setShouldTransition(true)
      // Reset transition flag after animation completes
      setTimeout(() => setShouldTransition(false), 350)
    }
    prevShowDrawerRef.current = showDrawer
  }, [showDrawer])

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading space...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={loadSpace}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <p className="text-gray-600">No space data available</p>
      </div>
    )
  }

  // Use space image as background, or scene background if space doesn't have one
  const backgroundImage = space.backgroundImage || space.image
  
  if (!backgroundImage) {
    return (
      <div className="w-full flex items-center justify-center bg-gray-100" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <p className="text-gray-600">No background image available for this space</p>
      </div>
    )
  }

  const scaledWidth = space.backgroundImageSize ? space.backgroundImageSize.width * scale : 1920 * scale
  const scaledHeight = space.backgroundImageSize ? space.backgroundImageSize.height * scale : 1080 * scale
  const visibleImages = getVisibleImages()

  return (
    <div className="w-full bg-black" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Horizontal scroll container */}
      <div 
        ref={scrollContainerRef}
        className={`w-full h-full hide-scrollbars ${showDrawer ? 'overflow-hidden pointer-events-none' : 'overflow-auto'}`}
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
          scrollSnapType: 'x proximity',
          ...(showDrawer && { height: '70vh' }),
          ...(shouldTransition && { transition: `height ${TRANSITION_STYLE}` })
        }}
      >
        <div 
          ref={containerRef}
          className="space-container relative"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            minWidth: '100vw',
            ...(shouldTransition && { transition: `width ${TRANSITION_STYLE}, height ${TRANSITION_STYLE}` })
          }}
        >
          {/* Background Image */}
          <Image
            src={backgroundImage}
            alt={`${space.name} - Swipe to explore`}
            width={scaledWidth}
            height={scaledHeight}
            className="scene-bg-image absolute top-0 left-0 w-full h-full object-cover select-none"
            priority
            draggable={false}
            style={{
              touchAction: 'pan-x pan-y',
            }}
            onError={() => {
              console.error('Failed to load background image:', backgroundImage)
              // You could set a fallback image here
            }}
          />

          {/* Placed Products */}
          {visibleImages.map((image) => {
            // Find the placement that contains this image
            const placement = space.placements.find((p: Placement) => 
              p.products.some((product: ProductImage) => product.id === image.id)
            )
            
            return (
              <React.Fragment key={`image-${image.id}`}>
                <Image
                  src={image.src}
                  alt={image.name}
                  width={image.width * scale}
                  height={image.height * scale}
                  className="scene-product-image absolute select-none"
                  style={{
                    left: `${image.x * scale}px`,
                    top: `${image.y * scale}px`,
                    width: `${image.width * scale}px`,
                    height: `${image.height * scale}px`,
                    opacity: space.type === 'street' ? 0 : 1,
                    ...(shouldTransition && { transition: `left ${TRANSITION_STYLE}, top ${TRANSITION_STYLE}, width ${TRANSITION_STYLE}, height ${TRANSITION_STYLE}` })
                  }}
                  draggable={false}
                  onError={(e) => {
                    console.error('Failed to load placement product:', image.src)
                    e.currentTarget.style.display = 'none'
                  }}
                />
                {/* Only show hotspot if placement has products */}
                {placement && placement.products.length > 0 &&
                  createHotspot(image, placement)
                }
              </React.Fragment>
            )
          })}
        </div>
      </div>
      
      {/* Space info indicator */}
      {!hideIndicators && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
          <h2 className="font-medium">{space.name}</h2>
          {visibleImages.length > 0 && (
            <p className="text-xs opacity-75 mt-1">
              {visibleImages.length} item{visibleImages.length !== 1 ? 's' : ''} placed
            </p>
          )}
        </div>
      )}

      {/* Scroll indicator */}
      {!hideIndicators && (scaledWidth > window.innerWidth || scaledHeight > window.innerHeight) && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs flex items-center space-x-2">
          <span>Swipe to explore</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Floating Fullscreen Button - hide in native fullscreen */}
      {!isNativeFullscreen && (
        <button
          onClick={handleFullscreen}
          className="fixed bottom-6 right-6 z-50 bg-black/80 hover:bg-black text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
          title="View in fullscreen"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      )}

      {/* Fullscreen Modal */}
      {showFullscreen && fullscreenImageSrc && (
        <div className="fullscreen-container fixed inset-0 bg-black z-50">
          {/* Close button - positioned over the image */}
          <button
            onClick={handleExitFullscreen}
            className="fixed top-4 right-4 z-60 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors backdrop-blur-sm"
            title="Exit fullscreen"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Instructions for mobile - only show in portrait mode */}
          {window.innerHeight > window.innerWidth && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-60 text-white/90 text-sm text-center bg-black/60 px-4 py-3 rounded-lg backdrop-blur-sm border border-white/20">
              <p>Rotate your device for best viewing experience</p>
            </div>
          )}

          {/* Fullscreen Image - occupies full screen */}
          <img
            src={fullscreenImageSrc}
            alt="Fullscreen view"
            className={`w-full h-full ${window.innerHeight > window.innerWidth ? 'object-cover' : 'object-contain'}`}
            style={{
              touchAction: 'auto', // Enable native touch gestures (zoom/pan)
              // Only apply rotation if device is in portrait mode (to suggest landscape)
              ...(window.innerHeight > window.innerWidth ? {
                transform: 'rotate(90deg) translate(0, -100%)',
                transformOrigin: 'top left',
                width: '100vh',
                height: '100vw',
                maxWidth: 'none',
                maxHeight: 'none'
              } : {
                transform: 'rotate(0deg)'
              })
            }}
          />
        </div>
      )}

      {/* Product Selection Drawer */}
      {/* <ProductSelectionDrawer
        isOpen={showDrawer}
        placement={selectedPlacement}
        onClose={closeDrawer}
        onProductSwitch={handleImageSwitch}
        onDeletePlacement={handleDeletePlacement}
        onDeleteProduct={handleDeleteProduct}
        artStory={artStoryData}
        artStoryLoading={artStoryLoading}
        onStoryClick={handleStoryIconClick}
      /> */}

      {/* Product Swipe Drawer */}
      <ProductSwipeDrawer
        isOpen={showDrawer}
        placement={selectedPlacement}
        onClose={closeDrawer}
        onProductSwitch={handleImageSwitch}
        onDeletePlacement={handleDeletePlacement}
        onDeleteProduct={handleDeleteProduct}
        artStory={artStoryData}
        artStoryLoading={artStoryLoading}
        onStoryClick={handleStoryIconClick}
      />

      {/* Stories Modal */}
      <StoriesModal
        isOpen={showStoriesModal}
        onClose={() => setShowStoriesModal(false)}
        artStory={artStoryData}
      />
    </div>
  )
}
