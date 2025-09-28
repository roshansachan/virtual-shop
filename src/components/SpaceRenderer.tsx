'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import ImageSelectionDrawer from './ImageSelectionDrawer'
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
  expanded: boolean
  visible: boolean
  products: ProductImage[]
}

interface SpaceRendererProps {
  spaceId?: string
  hideIndicators?: boolean
}

export default function SpaceRenderer({ spaceId, hideIndicators = false }: SpaceRendererProps) {
  const [space, setSpace] = useState<SpaceConfig | null>(null)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
  const calculateScale = (bgWidth: number, bgHeight: number): number => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Calculate scale factors for both dimensions
    const scaleX = viewportWidth / bgWidth
    const scaleY = viewportHeight / bgHeight

    // If background is larger than viewport in both dimensions, keep original size (scale = 1)
    // This allows scrolling instead of scaling down
    if (bgWidth > viewportWidth && bgHeight > viewportHeight) {
      return 1
    }

    // If background is smaller than viewport, scale up to cover the viewport
    // Use the larger scale factor to ensure the image covers the entire viewport
    const scale = Math.max(scaleX, scaleY)
    
    return scale
  }

  /**
   * Gets the visible product from a placement (only one product per placement is shown)
   */
  const getVisibleImage = (placement: Placement): ProductImage | null => {
    return placement.products.find(product => product.visible) || placement.products[0] || null
  }

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
  const createHotspot = (image: ProductImage) => {
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
        className="absolute z-20 pointer-events-none"
        style={{
          left: `${hotspotX}px`,
          top: `${hotspotY}px`,
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
    )
  }

  /**
   * Handles hotspot click to show placement options
   */
  const handleHotspotClick = (placement: Placement) => {
    setSelectedPlacement(placement)
    setShowDrawer(true)
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
    closeDrawer()
  }

  /**
   * Closes the drawer
   */
  const closeDrawer = () => {
    setShowDrawer(false)
    setSelectedPlacement(null)
  }

  // Load space on mount or when props change
  useEffect(() => {
    loadSpace()
  }, [spaceId, loadSpace])

  // Update scaling when space loads or window resizes
  useEffect(() => {
    if (!space || !space.backgroundImageSize) return

    const updateScale = () => {
      const newScale = calculateScale(
        space.backgroundImageSize!.width,
        space.backgroundImageSize!.height
      )
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [space])

  // Enhanced smooth scrolling
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.style.scrollBehavior = 'smooth'
    // @ts-expect-error - WebKit specific property for smooth scrolling
    container.style.webkitOverflowScrolling = 'touch'
    container.style.overscrollBehaviorX = 'contain'
    
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
  }, [space])

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading space...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
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
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">No space data available</p>
      </div>
    )
  }

  // Use space image as background, or scene background if space doesn't have one
  const backgroundImage = space.backgroundImage || space.image
  
  if (!backgroundImage) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">No background image available for this space</p>
      </div>
    )
  }

  const scaledWidth = space.backgroundImageSize ? space.backgroundImageSize.width * scale : 1920 * scale
  const scaledHeight = space.backgroundImageSize ? space.backgroundImageSize.height * scale : 1080 * scale
  const visibleImages = getVisibleImages()

  return (
    <div className="w-full" style={{ height: '100vh' }}>
      {/* Horizontal scroll container */}
      <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollSnapType: 'x proximity',
        }}
      >
        <div 
          ref={containerRef}
          className="relative"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            minWidth: '100vw'
          }}
        >
          {/* Background Image */}
          <Image
            src={backgroundImage}
            alt={`${space.name} - Swipe to explore`}
            width={scaledWidth}
            height={scaledHeight}
            className="absolute top-0 left-0 w-full h-full object-cover select-none"
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
                  className="absolute select-none cursor-pointer"
                  style={{
                    left: `${image.x * scale}px`,
                    top: `${image.y * scale}px`,
                    width: `${image.width * scale}px`,
                    height: `${image.height * scale}px`,
                  }}
                  draggable={false}
                  onClick={() => placement && handleHotspotClick(placement)}
                  onError={(e) => {
                    console.error('Failed to load placement product:', image.src)
                    e.currentTarget.style.display = 'none'
                  }}
                />
                {/* Only show hotspot if placement has products */}
                {placement && placement.products.length > 0 &&
                  createHotspot(image)
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

      {/* Product Selection Drawer */}
      <ImageSelectionDrawer
        isOpen={showDrawer}
        placement={selectedPlacement}
        onClose={closeDrawer}
        onProductSwitch={handleImageSwitch}
      />
    </div>
  )
}
