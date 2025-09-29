'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import type { Placement, Product } from '../types'

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

interface ProductSelectionDrawerProps {
  isOpen: boolean
  placement: Placement | null
  onClose: () => void
  onProductSwitch: (product: Product) => void
}

export default function ProductSelectionDrawer({
  isOpen,
  placement,
  onClose,
  onProductSwitch
}: ProductSelectionDrawerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [currentTransform, setCurrentTransform] = useState(0)
  
  // Animation state for smooth unmounting
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  // Scroll timeout ref for cleanup
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true)
    setDragStartY(clientY)
    setCurrentTransform(0)
  }, [])

  // Debounced scroll handler to prevent rapid firing during fast scrolling
  const debouncedHandleScroll = useMemo(
    () => debounce(() => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      const imageContainers = scrollContainer.querySelectorAll('.image-container')
      
      const scrollTimeout = scrollTimeoutRef.current

      const updateActiveElement = () => {
        const containerRect = scrollContainer.getBoundingClientRect()
        const containerCenter = containerRect.left + containerRect.width / 2
        
        let closestElement: Element | null = null
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
        
        // Reset all elements to inactive state first
        imageContainers.forEach((element) => {
          (element as HTMLElement).style.width = '70%'
          const ctaButtons = element.querySelector('.cta-buttons') as HTMLElement
          if (ctaButtons) {
            ctaButtons.style.opacity = '0'
            ctaButtons.style.pointerEvents = 'none'
          }
        })
        
        // Set the closest element as active
        if (closestElement) {
          (closestElement as HTMLElement).style.width = '80%'
          const ctaButtons = (closestElement as HTMLElement).querySelector('.cta-buttons') as HTMLElement
          if (ctaButtons) {
            ctaButtons.style.opacity = '1'
            ctaButtons.style.pointerEvents = 'auto'
          }
        }
      }

      const snapToCenter = () => {
        if (!scrollContainer) return

        const containerRect = scrollContainer.getBoundingClientRect()
        const containerCenter = containerRect.left + containerRect.width / 2
        
        let closestElement: Element | null = null
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
      }

      updateActiveElement()
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      
      // Set a new timeout to snap to center after scrolling stops
      scrollTimeoutRef.current = setTimeout(() => {
        snapToCenter()
      }, 50)
    }, 16),
    []
  )

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return
    
    const deltaY = clientY - dragStartY
    // Only allow downward dragging (positive deltaY)
    const transform = Math.max(0, deltaY)
    setCurrentTransform(transform)
    
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${transform}px)`
      // Linear opacity decrease: from 1.0 at 0px to 0.0 at 200px
      const maxDragDistance = 200
      const opacity = Math.max(0, 1 - (transform / maxDragDistance))
      drawerRef.current.style.opacity = opacity.toString()
    }
  }, [isDragging, dragStartY])
  
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    // If dragged down more than 100px, close the drawer
    if (currentTransform > 100) {
      onClose()
    } else {
      // Animate back to original position
      if (drawerRef.current) {
        drawerRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out'
        drawerRef.current.style.transform = 'translateY(0px)'
        drawerRef.current.style.opacity = '1'
        
        // Remove transition after animation completes
        setTimeout(() => {
          if (drawerRef.current) {
            drawerRef.current.style.transition = ''
          }
        }, 300)
      }
    }
    
    setCurrentTransform(0)
  }, [isDragging, currentTransform, onClose])
  
  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }, [handleDragStart])
  
  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])
  
  // Global mouse/touch move and end events
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY)
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault() // Prevent scrolling
      handleDragMove(e.touches[0].clientY)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleDragEnd)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleDragEnd)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])
  
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
      
      // After scrolling, ensure CTA buttons are properly shown/hidden
      setTimeout(() => {
        scrollContainer.style.scrollBehavior = originalScrollBehavior
        
        // Hide all CTA buttons first
        const allCtaButtons = scrollContainer.querySelectorAll('.cta-buttons')
        allCtaButtons.forEach(button => {
          (button as HTMLElement).style.opacity = '0'
          ;(button as HTMLElement).style.pointerEvents = 'none'
        })
        
        // Show CTA buttons for the current product
        const currentCtaButtons = currentProductElement.querySelector('.cta-buttons') as HTMLElement
        if (currentCtaButtons) {
          currentCtaButtons.style.opacity = '1'
          currentCtaButtons.style.pointerEvents = 'auto'
        }
        
        // Also update the width for active element
        const allImageContainers = scrollContainer.querySelectorAll('.image-container')
        allImageContainers.forEach(container => {
          (container as HTMLElement).style.width = '70%'
        })
        currentProductElement.style.width = '80%'
      }, 0)
    }
  }, [isVisible, placement])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const imageContainers = scrollContainer.querySelectorAll('.image-container')
    
    let activeElement: Element | null = null

    // Initial check
    const updateActiveElement = () => {
      const containerRect = scrollContainer.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2
      
      let closestElement: Element | null = null
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
          (activeElement as HTMLElement).style.width = '70%'
          const prevCtaButtons = activeElement.querySelector('.cta-buttons') as HTMLElement
          if (prevCtaButtons) {
            prevCtaButtons.style.opacity = '0'
            prevCtaButtons.style.pointerEvents = 'none'
          }
        }
        
        // Set new active element
        activeElement = closestElement
        if (activeElement) {
          (activeElement as HTMLElement).style.width = '70%'
          const ctaButtons = (activeElement as HTMLElement).querySelector('.cta-buttons') as HTMLElement
          if (ctaButtons) {
            ctaButtons.style.opacity = '1'
            ctaButtons.style.pointerEvents = 'auto'
          }
        }
      }
    }

    updateActiveElement()
    
    // Listen to scroll events with debounced handler
    scrollContainer.addEventListener('scroll', debouncedHandleScroll, { passive: true })
    
    // Also listen to resize events in case container size changes
    const resizeObserver = new ResizeObserver(updateActiveElement)
    resizeObserver.observe(scrollContainer)

    return () => {
      scrollContainer.removeEventListener('scroll', debouncedHandleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
      resizeObserver.disconnect()
    }
  }, [placement?.products, isVisible, debouncedHandleScroll])

  if (!shouldRender || !placement) return null

  return (
    <div className={`fixed inset-0 bg-black/50 z-30 flex items-end font-belleza transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        ref={drawerRef}
        className="bg-black w-full rounded-t-3xl shadow-lg max-h-[85vh] flex flex-col"
        style={{ 
          transform: isVisible ? 'translateY(0px)' : 'translateY(100%)', 
          transition: 'transform 0.3s ease-out',
          touchAction: 'none' // Disable pull-to-refresh when drawer is active
        }}
      >
        {/* Drag Handle */}
        <div 
          ref={dragHandleRef}
          className="flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="w-10 h-1 bg-white/30 rounded-full"></div>
        </div>

        {/* Drawer Header */}
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
              <Image
                src="/story-icon.png"
                alt="Story icon"
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xl text-white font-normal leading-tight" style={{ fontFamily: 'Belleza', letterSpacing: '-0.02em' }}>
                {placement.name}
              </h3>
              <p className="text-xs text-[#FFEC8E] font-normal leading-tight" style={{ fontFamily: 'Belleza', letterSpacing: '-0.02em' }}>
                Unfold The Story→
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Snap Scrolling Image Gallery */}
        <div className="flex-1 overflow-hidden pb-10">
          <div ref={scrollContainerRef} className="h-full min-h-[352px] overflow-x-auto overflow-y-hidden snap-x snap-mandatory snap-smooth hide-scrollbars">
            <div className="flex h-full">
              {/* Left padding slide */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-1.5 opacity-0" style={{ width: '70%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[16/11] relative bg-transparent rounded-2xl overflow-hidden mb-3"></div>
                  <div className="text-left mb-3 invisible">
                    <div className="h-6 bg-transparent mb-1"></div>
                    <div className="h-6 bg-transparent w-24"></div>
                  </div>
                  <div className="flex gap-2 sm:gap-3 invisible">
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                  </div>
                </div>
              </div>
              
              {placement.products.map((product) => (
                <div key={product.id} data-product-id={product.id} className="image-container flex-shrink-0 snap-center flex flex-col items-center justify-center px-1.5 transition-all duration-300 ease-out" style={{ width: '70%' }}>
                  <div className="w-full max-w-sm">
                    {/* Product Image - Landscape aspect ratio */}
                    <div className="aspect-[16/11] relative bg-gray-200 rounded-2xl overflow-hidden mb-3">
                      {product.src ? (
                        <Image
                          src={product?.productInfo?.productImage || product.src} // Fallback to src if productImage is not available
                          alt={product.name}
                          width={160}
                          height={110}
                          className="object-cover w-full h-full"
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
                    
                    {/* Product Details */}
                    <div className="text-left mb-3">
                      <h4 className="text-white text-base font-normal leading-tight mb-1 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.3'
                      }}>
                        {product?.productInfo?.productName || product.name}
                      </h4>
                      
                      {/* Price */}
                      <div className="inline-flex gap-2 items-center">
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
                      </div>
                    </div>
                    
                    {/* Action Buttons - Three in a row */}
                    <div className="cta-buttons flex gap-3 transition-opacity duration-300 justify-center">
                      <div className="h-8 sm:px-2.5 py-1 bg-white rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors active:scale-95 min-w-[90px] px-[10px]">
                        <div className="text-[#333333] text-xs font-normal leading-none truncate">
                          Buy Now
                        </div>
                      </div>

                      <div
                        onClick={() => !product.visible && onProductSwitch(product)}
                        className={`h-8 sm:px-2.5 py-1 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden transition-all min-w-[90px] px-[10px] ${
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
                      </div>
                      
                      {/* <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 border border-white/30 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-white/10 transition-colors active:scale-95">
                        <div className="text-white text-xs font-normal leading-none truncate">
                          Details
                        </div>
                      </div> */}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Right padding slide */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-1.5 opacity-0" style={{ width: '70%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[16/11] relative bg-transparent rounded-2xl overflow-hidden mb-3"></div>
                  <div className="text-left mb-3 invisible">
                    <div className="h-6 bg-transparent mb-1"></div>
                    <div className="h-6 bg-transparent w-24"></div>
                  </div>
                  <div className="flex gap-2 sm:gap-3 invisible">
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                    <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-transparent rounded-xs"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
