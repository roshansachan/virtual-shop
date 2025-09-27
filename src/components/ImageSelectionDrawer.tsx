'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import type { Placement, Product } from '../types'

interface ImageSelectionDrawerProps {
  isOpen: boolean
  placement: Placement | null
  onClose: () => void
  onProductSwitch: (product: Product) => void
}

export default function ImageSelectionDrawer({
  isOpen,
  placement,
  onClose,
  onProductSwitch
}: ImageSelectionDrawerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [currentTransform, setCurrentTransform] = useState(0)
  
  // Drag handlers
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true)
    setDragStartY(clientY)
    setCurrentTransform(0)
  }, [])
  
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
  
  // Reset transform when drawer closes
  useEffect(() => {
    if (!isOpen && drawerRef.current) {
      drawerRef.current.style.transform = 'translateY(0px)'
      drawerRef.current.style.opacity = '1'
      drawerRef.current.style.transition = ''
    }
  }, [isOpen])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const imageContainers = scrollContainer.querySelectorAll('.image-container')
    
    let activeElement: Element | null = null

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
          (activeElement as HTMLElement).style.width = '60%'
          const prevCtaButtons = activeElement.querySelector('.cta-buttons') as HTMLElement
          if (prevCtaButtons) {
            prevCtaButtons.style.opacity = '0'
            prevCtaButtons.style.pointerEvents = 'none'
          }
        }
        
        // Set new active element
        activeElement = closestElement
        if (activeElement) {
          (activeElement as HTMLElement).style.width = '80%'
          const ctaButtons = (activeElement as HTMLElement).querySelector('.cta-buttons') as HTMLElement
          if (ctaButtons) {
            ctaButtons.style.opacity = '1'
            ctaButtons.style.pointerEvents = 'auto'
          }
        }
      }
    }

    // Initial check
    updateActiveElement()
    
    // Listen to scroll events
    scrollContainer.addEventListener('scroll', updateActiveElement, { passive: true })
    
    // Also listen to resize events in case container size changes
    const resizeObserver = new ResizeObserver(updateActiveElement)
    resizeObserver.observe(scrollContainer)

    return () => {
      scrollContainer.removeEventListener('scroll', updateActiveElement)
      resizeObserver.disconnect()
    }
  }, [placement?.products])

  if (!isOpen || !placement) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end font-belleza">
      <div 
        ref={drawerRef}
        className="bg-black w-full rounded-t-3xl shadow-lg max-h-[85vh] flex flex-col"
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
          <h3 className="text-xl text-white">{placement.name}</h3>
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
          <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden snap-x snap-proximity snap-smooth">
            <div className="flex h-full">
              {/* Left padding slide */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-1.5 opacity-0" style={{ width: '60%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[16/11] relative bg-transparent rounded-2xl overflow-hidden mb-6"></div>
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
                <div key={product.id} className="image-container flex-shrink-0 snap-center flex flex-col items-center justify-center px-1.5 transition-all duration-300 ease-out" style={{ width: '60%' }}>
                  <div className="w-full max-w-sm">
                    {/* Product Image - Landscape aspect ratio */}
                    <div className="aspect-[16/11] relative bg-gray-200 rounded-2xl overflow-hidden mb-6">
                      {product.src ? (
                        <Image
                          src={product.src}
                          alt={product.name}
                          fill
                          className="object-contain"
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
                      <h4 className="text-white text-base font-normal">
                        {product.name}
                      </h4>
                      
                      {/* Price */}
                      <div className="text-base font-normal text-white">
                        ₹1,299
                      </div>
                    </div>
                    
                    {/* Action Buttons - Three in a row */}
                    <div className="cta-buttons flex gap-2 sm:gap-3 transition-opacity duration-300">
                      <div
                        onClick={() => !product.visible && onProductSwitch(product)}
                        className={`flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer transition-all ${
                          product.visible
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-white hover:bg-gray-100 active:scale-95'
                        }`}
                      >
                        <div className={`text-xs font-normal leading-none truncate ${
                          product.visible ? 'text-white' : 'text-[#333333]'
                        }`}>
                          {product.visible ? 'Selected' : 'Try On'}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 border border-white/30 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-white/10 transition-colors active:scale-95">
                        <div className="text-white text-xs font-normal leading-none truncate">
                          Details
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-white rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors active:scale-95">
                        <div className="text-[#333333] text-xs font-normal leading-none truncate">
                          Buy Now
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Right padding slide */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-1.5 opacity-0" style={{ width: '60%' }}>
                <div className="w-full max-w-sm invisible">
                  <div className="aspect-[16/11] relative bg-transparent rounded-2xl overflow-hidden mb-6"></div>
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
              
              {/* Static placeholder assets - only visible when scrolled to */}
              {/* {[1, 2, 3].map((index) => (
                <div key={`placeholder-${index}`} className="image-container flex-shrink-0 snap-center flex flex-col items-center justify-center px-1.5 transition-all duration-300 ease-out" style={{ width: '60%' }}>
                  <div className="w-full max-w-sm">

                    <div className="aspect-[16/11] relative bg-gray-200 rounded-2xl overflow-hidden mb-6 flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    
                    <div className="text-left mb-3">
                      <div className="h-6 bg-gray-700 rounded animate-pulse mb-1"></div>
                      <div className="h-6 bg-gray-700 rounded w-24 animate-pulse"></div>
                    </div>
                    
                    <div className="flex gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-gray-700 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden animate-pulse">
                        <div className="w-12 h-3 bg-gray-600 rounded animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-gray-700 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden animate-pulse">
                        <div className="w-12 h-3 bg-gray-600 rounded animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0 h-8 px-2 sm:px-2.5 py-1 bg-gray-700 rounded-xs inline-flex justify-center items-center gap-1 overflow-hidden animate-pulse">
                        <div className="w-12 h-3 bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))} */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
