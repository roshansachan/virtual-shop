'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import type { Placement, Product } from '../types'
import closeIcon from '@/assets/close-icon.svg'

// Throttle utility function for better scroll performance
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

interface ProductSwipeDrawerProps {
  isOpen: boolean
  placement: Placement | null
  onClose: () => void
  onProductSwitch: (product: Product) => void
  onDeletePlacement?: (placementId: string) => Promise<void>
  onDeleteProduct?: (productId: string) => Promise<void>
  artStory?: {
    id: number;
    title: string;
    stories: Array<{
      id: string;
      media: {
        type: 'image' | 'video';
        s3Key: string;
      };
      title?: string;
      description?: string;
    }>;
  } | null;
  artStoryLoading?: boolean;
  onStoryClick?: () => void;
}

export default function ProductSwipeDrawer({
  isOpen,
  placement,
  artStory,
  artStoryLoading,
  onClose,
  onProductSwitch,
  onDeletePlacement,
  onDeleteProduct,
  onStoryClick
}: ProductSwipeDrawerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Animation state for smooth unmounting
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  // Scroll timeout ref for cleanup
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Screen dimensions state for responsive width
  const [screenHeight, setScreenHeight] = useState<number>(0)
  const [screenWidth, setScreenWidth] = useState<number>(0)
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'placement' | 'product', id: string, name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Update screen dimensions on mount and resize
  useEffect(() => {
    const updateScreenDimensions = () => {
      setScreenHeight(window.innerHeight)
      setScreenWidth(window.innerWidth)
    }
    updateScreenDimensions()
    window.addEventListener('resize', updateScreenDimensions)
    return () => window.removeEventListener('resize', updateScreenDimensions)
  }, [])
  
  // Handle delete placement
  const handleDeletePlacement = useCallback(async () => {
    if (!showDeleteConfirm || showDeleteConfirm.type !== 'placement' || !onDeletePlacement) return
    
    setIsDeleting(true)
    try {
      await onDeletePlacement(showDeleteConfirm.id)
      setShowDeleteConfirm(null)
      onClose() // Close drawer after deleting placement
    } catch (error) {
      console.error('Failed to delete placement:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [showDeleteConfirm, onDeletePlacement, onClose])
  
  // Handle delete product
  const handleDeleteProduct = useCallback(async () => {
    if (!showDeleteConfirm || showDeleteConfirm.type !== 'product' || !onDeleteProduct) return
    
    setIsDeleting(true)
    try {
      await onDeleteProduct(showDeleteConfirm.id)
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete product:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [showDeleteConfirm, onDeleteProduct])

  // Throttled scroll handler for smooth performance
  const throttledHandleScroll = useMemo(
    () => throttle(() => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      const imageContainers = scrollContainer.querySelectorAll('.image-container') as NodeListOf<HTMLElement>
      
      const scrollTimeout = scrollTimeoutRef.current

      const updateActiveElement = () => {
        const containerRect = scrollContainer.getBoundingClientRect()
        const containerCenter = containerRect.left + containerRect.width / 2
        
        let closestElement: HTMLElement | null = null
        let minDistance = Infinity
        
        imageContainers.forEach((element) => {
          const elementRect = element.getBoundingClientRect()
          const elementCenter = elementRect.left + elementRect.width / 2
          const distance = Math.abs(elementCenter - containerCenter)
          
          if (distance < minDistance) {
            minDistance = distance
            closestElement = element
          }
        })
        
        // Update active state using CSS classes instead of direct style manipulation
        imageContainers.forEach((element) => {
          element.classList.remove('active')
        })
        
        if (closestElement) {
          (closestElement as HTMLElement).classList.add('active')
        }
      }

      updateActiveElement()
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      
      // Set a new timeout to snap to center after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        if (!scrollContainer) return

        const containerRect = scrollContainer.getBoundingClientRect()
        const containerCenter = containerRect.left + containerRect.width / 2
        
        let closestElement: HTMLElement | null = null
        let minDistance = Infinity
        let targetScrollLeft = scrollContainer.scrollLeft
        
        imageContainers.forEach((element) => {
          const elementRect = element.getBoundingClientRect()
          const elementCenter = elementRect.left + elementRect.width / 2
          const distance = Math.abs(elementCenter - containerCenter)
          
          if (distance < minDistance) {
            minDistance = distance
            closestElement = element
            // Calculate the scroll position needed to center this element
            const elementLeft = (element as HTMLElement).offsetLeft
            const elementWidth = (element as HTMLElement).offsetWidth
            const containerWidth = scrollContainer.clientWidth
            targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2)
          }
        })
        
        // Smoothly scroll to the calculated position
        if (closestElement && Math.abs(scrollContainer.scrollLeft - targetScrollLeft) > 1) {
          scrollContainer.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
          })
        }
        
        // Trigger product switch after scrolling stops and snaps to center
        if (closestElement) {
          const productId = (closestElement as HTMLElement).getAttribute('data-product-id')
          if (productId && placement) {
            const product = placement.products.find(p => p.id === productId)
            const currentlyVisibleProduct = placement.products.find(p => p.visible)
            if (product && !product.visible && product.id !== currentlyVisibleProduct?.id) {
              onProductSwitch(product)
            }
          }
        }
      }, 150) // Increased timeout for better UX
    }, 16), // ~60fps throttling
    [onProductSwitch, placement]
  )

  // Manage rendering and visibility for smooth animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Small delay to ensure DOM is ready before animating in
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
      // Delay unmounting until animation completes
      setTimeout(() => setShouldRender(false), 300)
    }
  }, [isOpen])

  // Scroll current product into view when drawer opens
  useEffect(() => {
    if (!isVisible || !placement || !scrollContainerRef.current) return

    const currentProduct = placement.products.find(product => product.visible)
    if (!currentProduct) return

    const scrollContainer = scrollContainerRef.current
    const currentProductElement = scrollContainer.querySelector(`[data-product-id="${currentProduct.id}"]`) as HTMLElement
    
    if (currentProductElement) {
      // Calculate the scroll position to center the current product
      const containerWidth = scrollContainer.clientWidth
      const elementWidth = currentProductElement.offsetWidth
      const elementLeft = currentProductElement.offsetLeft
      const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2)
      
      // Temporarily disable smooth scrolling to force instant scroll
      const originalScrollBehavior = scrollContainer.style.scrollBehavior
      scrollContainer.style.scrollBehavior = 'auto'
      
      scrollContainer.scrollTo({
        left: Math.max(0, scrollLeft)
      })
      
      // After scrolling, ensure active state is properly set
      setTimeout(() => {
        scrollContainer.style.scrollBehavior = originalScrollBehavior
        
        // Reset all elements to inactive state
        const allImageContainers = scrollContainer.querySelectorAll('.image-container') as NodeListOf<HTMLElement>
        allImageContainers.forEach(container => {
          container.classList.remove('active')
        })
        
        // Set the current product as active
        currentProductElement.classList.add('active')
      }, 0)
    }
  }, [isVisible, placement])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const imageContainers = scrollContainer.querySelectorAll('.image-container') as NodeListOf<HTMLElement>
    
    let activeElement: HTMLElement | null = null

    // Initial check
    const updateActiveElement = () => {
      const containerRect = scrollContainer.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2
      
      let closestElement: HTMLElement | null = null
      let minDistance = Infinity
      
      imageContainers.forEach((element) => {
        const elementRect = element.getBoundingClientRect()
        const elementCenter = elementRect.left + elementRect.width / 2
        const distance = Math.abs(elementCenter - containerCenter)
        
        if (distance < minDistance) {
          minDistance = distance
          closestElement = element
        }
      })
      
      // Only update if the active element changed
      if (activeElement !== closestElement) {
        // Reset previous active element
        if (activeElement) {
          (activeElement as HTMLElement).classList.remove('active')
        }
        
        // Set new active element
        activeElement = closestElement
        if (activeElement) {
          (activeElement as HTMLElement).classList.add('active')
        }
      }
    }

    updateActiveElement()
    
    // Listen to scroll events with throttled handler
    scrollContainer.addEventListener('scroll', throttledHandleScroll, { passive: true })
    
    // Also listen to resize events in case container size changes
    const resizeObserver = new ResizeObserver(updateActiveElement)
    resizeObserver.observe(scrollContainer)

    return () => {
      scrollContainer.removeEventListener('scroll', throttledHandleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
      resizeObserver.disconnect()
    }
  }, [placement?.products, isVisible, throttledHandleScroll])

  if (!shouldRender || !placement) return null

  return (
    <>
      <style jsx>{`
        @keyframes progress-spin {
          0% {
            stroke-dashoffset: 125.6;
          }
          50% {
            stroke-dashoffset: 31.4;
          }
          100% {
            stroke-dashoffset: 125.6;
          }
        }
      `}</style>
    <div
      className={`fixed inset-0 bg-transparent z-30 flex items-end font-belleza transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      data-drawer="true"
      onClick={onClose}
    >
      <div
        className="bg-black w-full shadow-lg h-[30vh] flex flex-col justify-between"
        style={{ 
          transform: isVisible ? 'translateY(0px)' : 'translateY(100%)', 
          transition: 'transform 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Drawer Header */}
        <div className="flex justify-between items-center px-6 pt-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Circular Progress Indicator */}
              {artStoryLoading && (
                <div className="absolute inset-0 w-11 h-11">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
                    <circle
                      cx="22"
                      cy="22"
                      r="20"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r="20"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="125.6"
                      strokeDashoffset="125.6"
                      className="animate-spin"
                      style={{
                        animation: 'progress-spin 1.5s linear infinite'
                      }}
                    />
                  </svg>
                </div>
              )}

              <button
                onClick={artStory && onStoryClick ? onStoryClick : undefined}
                disabled={!artStory || artStoryLoading}
                className={`w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden transition-all ${
                  artStory && !artStoryLoading ? 'hover:bg-white/20 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <Image
                  src="/story-icon.png"
                  alt="Story icon"
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
            <div className="flex flex-col">
              <h3 className="text-xl text-white font-normal leading-tight overflow-hidden" style={{
                fontFamily: 'Belleza',
                letterSpacing: '-0.02em',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
              }}>
                {placement.name}
              </h3>
              <p className="text-xs text-[#FFEC8E] font-normal leading-tight" style={{ fontFamily: 'Belleza', letterSpacing: '-0.02em' }}>
                {artStoryLoading ? 'Loading story...' : 'Unfold The Story→'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <Image
              src={closeIcon}
              alt="Close"
              width={10}
              height={10}
              className="w-2.5 h-2.5"
            />
          </button>
        </div>

        {/* Snap Scrolling Image Gallery */}
        <div className="overflow-hidden h-fit">
          <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory snap-smooth hide-scrollbars accelerated-scroll">
            <div className="flex">
              {/* Left padding slide */}
              <div className="h-fit flex-shrink-0 flex items-center justify-center py-4 px-3 opacity-0" style={{ width: screenWidth > 0 && (screenHeight / screenWidth) < 2 ? '50%' : '65%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[3/2] relative bg-transparent rounded-2xl overflow-hidden mb-3"></div>
                </div>
              </div>
              
              {placement.products.map((product) => (
                <div key={product.id} data-product-id={product.id} className={`image-container product-card h-fit flex-shrink-0 snap-center flex items-center justify-center py-4 px-3 ${screenWidth > 0 && (screenHeight / screenWidth) < 2 ? 'w-[50%]' : 'w-[65%]'}`}>
                  <div className="w-full max-w-sm">
                    <div className="relative image-aspect">
                      {/* Product Image - Landscape aspect ratio */}
                      <div className="aspect-[3/2] relative bg-gray-200 rounded-2xl overflow-hidden mb-3">
                        {product.src ? (
                          <Image
                            src={product?.productInfo?.productImage || product.src} // Fallback to src if productImage is not available
                            alt={product.name}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              // Fallback to grey placeholder on error
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="w-full h-full bg-gray-700 flex items-center justify-center"><svg class="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" /></svg></div>'
                              }
                            }}
                          />
                        ) : (
                          // Grey placeholder for assets without src
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="absolute bottom-3 left-3">
                        {/* Product Details */}
                        <div className="text-left mb-2">
                          <h4 className="text-white text-base font-normal leading-tight mb-1 overflow-hidden" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: '1.3'
                          }}>
                            {product?.productInfo?.productName || product.name}
                          </h4>
                          
                          {/* Price */}
                          {/* <div className="inline-flex gap-2 items-center">
                            {product?.productInfo?.discountPercentage && product?.productInfo?.originalPrice && (
                              <>
                                <span className="text-base font-normal text-white leading-tight mb-0.5">
                                  ${Math.round(Number(product.productInfo.originalPrice) * (1 - Number(product.productInfo.discountPercentage) / 100))}
                                </span>
                                <span className="text-white text-xs font-normal line-through leading-[14.40px]">${Math.round(Number(product.productInfo.originalPrice))}</span>
                                <span className="text-white text-xs font-normal leading-[14.40px]">({Math.round(Number(product.productInfo.discountPercentage))}% off)</span>
                              </>
                            )}
                            {!product?.productInfo?.discountPercentage && product?.productInfo?.originalPrice && (
                              <span className="text-base font-normal text-white leading-tight mb-0.5">
                                ${Math.round(Number(product.productInfo.originalPrice))}
                              </span>
                            )}
                          </div> */}
                        </div>

                        {/* Action Buttons - Row with delete option */}
                        <div className="cta-buttons flex gap-2 transition-opacity duration-300 justify-start">
                          <div className="h-8 sm:px-2.5 py-1 bg-white rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors active:scale-95 min-w-[70px] px-[8px]">
                            <div className="text-[#333333] text-xs font-normal leading-none truncate">
                              Buy Now
                            </div>
                          </div>

                          {/* <div
                            onClick={() => !product.visible && onProductSwitch(product)}
                            className={`h-8 sm:px-2.5 py-1 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden transition-all min-w-[70px] px-[8px] ${
                              product.visible
                                ? 'bg-gray-500 cursor-not-allowed'
                                : 'border border-white/30 active:scale-95 cursor-pointer'
                            }`}
                          >
                            <div className={`text-xs font-normal leading-none truncate ${
                              product.visible ? 'text-gray-300' : 'text-white'
                            }`}>
                              {product.visible ? 'Selected' : 'Try Now'}
                            </div>
                          </div> */}
                          
                          {/* Delete Product Button */}
                          {/* {onDeleteProduct && (
                            <button
                              onClick={() => setShowDeleteConfirm({ type: 'product', id: product.id, name: product.name })}
                              className="h-8 px-2 border border-red-400/30 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-red-500/10 transition-colors active:scale-95 min-w-[40px]"
                              title="Delete product"
                            >
                              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )} */}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Right padding slide */}
              <div className="h-fit flex-shrink-0 flex items-center justify-center py-4 px-3 opacity-0" style={{ width: screenWidth > 0 && (screenHeight / screenWidth) < 2 ? '50%' : '65%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[3/2] relative bg-transparent rounded-2xl overflow-hidden mb-3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Delete {showDeleteConfirm.type === 'placement' ? 'Placement' : 'Product'}
          </h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete {showDeleteConfirm.name}? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={showDeleteConfirm.type === 'placement' ? handleDeletePlacement : handleDeleteProduct}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
