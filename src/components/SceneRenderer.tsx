'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import ImageSelectionDrawer from './ImageSelectionDrawer'
import type { Scene, SceneConfig } from '../types'

// Types for the filesystem-based configuration
interface PlacementProductImage {
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
  images: PlacementProductImage[]
}

interface Scene {
  id: string
  name: string
  backgroundImage: string
  backgroundImageSize: { width: number; height: number }
  backgroundImageS3Key?: string
  placements: Placement[]
}

interface SceneConfig {
  scenes: Array<{
    index: number
    id: string
    name: string
    file: string
  }>
}

interface SceneRendererProps {
  sceneId?: string
  sceneIndex?: number
  hideIndicators?: boolean
}

export default function SceneRenderer({ sceneId, sceneIndex, hideIndicators = false }: SceneRendererProps) {
  const [scene, setScene] = useState<Scene | null>(null)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  /**
   * Loads scene configuration from filesystem or database
   */
  const loadScene = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // If sceneId is provided, fetch comprehensive data from database
      if (sceneId && /^\d+$/.test(sceneId)) {
        console.log('Fetching comprehensive scene data for sceneId:', sceneId);

        const comprehensiveResponse = await fetch(`/api/scenes/${sceneId}/comprehensive`);
        if (comprehensiveResponse.ok) {
          const comprehensiveData = await comprehensiveResponse.json();
          if (comprehensiveData.success) {
            console.log('Comprehensive Scene Data from Database:', comprehensiveData.data);
            // TODO: Transform this data into the Scene format expected by SceneRenderer
            // For now, we'll fall back to filesystem loading
          } else {
            console.error('Failed to fetch comprehensive scene data:', comprehensiveData.error);
          }
        } else {
          console.error('Comprehensive API call failed:', comprehensiveResponse.status);
        }
      }

      // First load the scene config index (filesystem fallback)
      const configResponse = await fetch('/sceneConfig.json')
      if (!configResponse.ok) {
        throw new Error('Failed to load scene configuration')
      }
      const config: SceneConfig = await configResponse.json()

      // Find the scene to load
      let sceneToLoad = null
      if (sceneId) {
        sceneToLoad = config.scenes.find(s => s.id === sceneId)
      } else if (sceneIndex !== undefined) {
        sceneToLoad = config.scenes.find(s => s.index === sceneIndex)
      } else {
        // Default to first scene
        sceneToLoad = config.scenes[0]
      }

      if (!sceneToLoad) {
        throw new Error('Scene not found')
      }

      // Load the individual scene file
      const sceneResponse = await fetch(`/scenes/${sceneToLoad.file}`)
      if (!sceneResponse.ok) {
        throw new Error('Failed to load scene data')
      }
      const sceneData: Scene = await sceneResponse.json()

      setScene(sceneData)
    } catch (err) {
      console.error('Error loading scene:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scene')
    } finally {
      setLoading(false)
    }
  }, [sceneId, sceneIndex])

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
   * Gets the visible image from a placement (only one image per placement is shown)
   */
  const getVisibleImage = (placement: Placement): PlacementProductImage | null => {
    return placement.images.find(img => img.visible) || placement.images[0] || null
  }

  /**
   * Gets all visible images across all placements for rendering
   */
  const getVisibleImages = (): PlacementProductImage[] => {
    if (!scene) return []

    return scene.placements
      .filter(placement => placement.visible)
      .map(placement => getVisibleImage(placement))
      .filter((img): img is PlacementProductImage => img !== null)
  }

  /**
   * Creates a hotspot element with pulsing animation
   */
  const createHotspot = (image: PlacementProductImage, placement: Placement) => {
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
        className="absolute cursor-pointer z-20"
        style={{
          left: `${hotspotX}px`,
          top: `${hotspotY}px`,
          width: `${hotspotSize}px`,
          height: `${hotspotSize}px`,
        }}
        onClick={() => handleHotspotClick(placement)}
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
   * Handles image switching within a placement
   */
  const handleImageSwitch = (newImage: PlacementProductImage) => {
    if (!scene || !selectedPlacement) return

    // Update the scene state to show the new image
    const updatedScene = {
      ...scene,
      placements: scene.placements.map(placement => {
        if (placement.id === selectedPlacement.id) {
          return {
            ...placement,
            images: placement.images.map(img => ({
              ...img,
              visible: img.id === newImage.id
            }))
          }
        }
        return placement
      })
    }

    setScene(updatedScene)
    setSelectedPlacement(updatedScene.placements.find(f => f.id === selectedPlacement.id) || null)
    closeDrawer()
  }

  /**
   * Closes the drawer
   */
  const closeDrawer = () => {
    setShowDrawer(false)
    setSelectedPlacement(null)
  }

  // Load scene on mount or when props change
  useEffect(() => {
    loadScene()
  }, [sceneId, sceneIndex, loadScene])

  // Update scaling when scene loads or window resizes
  useEffect(() => {
    if (!scene) return

    const updateScale = () => {
      const newScale = calculateScale(
        scene.backgroundImageSize.width,
        scene.backgroundImageSize.height
      )
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [scene])

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
  }, [scene])

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scene...</p>
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
            onClick={loadScene}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!scene) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">No scene data available</p>
      </div>
    )
  }

  const scaledWidth = scene.backgroundImageSize.width * scale
  const scaledHeight = scene.backgroundImageSize.height * scale
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
            src={scene.backgroundImage}
            alt={`${scene.name} - Swipe to explore`}
            width={scaledWidth}
            height={scaledHeight}
            className="absolute top-0 left-0 w-full h-full object-cover select-none"
            priority
            draggable={false}
            style={{
              touchAction: 'pan-x pan-y',
            }}
            onError={() => {
              console.error('Failed to load background image:', scene.backgroundImage)
              // You could set a fallback image here
            }}
          />

          {/* Placed Placements */}
          {visibleImages.map((image) => {
            const placementWithImage = scene.placements.find(f => f.images.some(img => img.id === image.id))
            
            return (
              <React.Fragment key={`image-${image.id}`}>
                <Image
                  src={image.src}
                  alt={image.name}
                  width={image.width * scale}
                  height={image.height * scale}
                  className="absolute select-none"
                  style={{
                    left: `${image.x * scale}px`,
                    top: `${image.y * scale}px`,
                    width: `${image.width * scale}px`,
                    height: `${image.height * scale}px`,
                  }}
                  draggable={false}
                  onError={(e) => {
                    console.error('Failed to load placement image:', image.src)
                    e.currentTarget.style.display = 'none'
                  }}
                />
                {/* Only show hotspot if placement has multiple images and indicators are not hidden */}
                {placementWithImage && placementWithImage.images.length > 0 &&
                  createHotspot(image, placementWithImage)
                }
              </React.Fragment>
            )
          })}
        </div>
      </div>
      
      {/* Scene info indicator */}
      {!hideIndicators && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
          <h2 className="font-medium">{scene.name}</h2>
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

      {/* Image Selection Drawer */}
      <ImageSelectionDrawer
        isOpen={showDrawer}
        folder={selectedFolder}
        onClose={closeDrawer}
        onImageSwitch={handleImageSwitch}
      />
    </div>
  )
}
