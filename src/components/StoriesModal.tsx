'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { generateS3Url } from '@/lib/s3-utils';

interface StoryItem {
  id: string;
  media: {
    type: 'image' | 'video';
    s3Key: string;
  };
  title?: string;
  description?: string;
}

interface ArtStory {
  id: number;
  title: string;
  stories: StoryItem[];
}

interface StoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  artStory: ArtStory | null;
}

export default function StoriesModal({ isOpen, onClose, artStory }: StoriesModalProps) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [currentStoryDuration, setCurrentStoryDuration] = useState(5000);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  
  // Touch/swipe state
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  console.log('🔄 StoriesModal render', { 
    isOpen, 
    currentStoryIndex, 
    isPaused,
    artStoryId: artStory?.id 
  });

  const stories = artStory?.stories || [];
  const currentStory = stories[currentStoryIndex];

  // Debug story data and URLs
  console.log('🎬 Stories Debug:', {
    totalStories: stories.length,
    currentStoryIndex,
    currentStory: currentStory ? {
      id: currentStory.id,
      type: currentStory.media.type,
      s3Key: currentStory.media.s3Key,
      generatedUrl: generateS3Url(currentStory.media.s3Key)
    } : null,
    allStoryKeys: stories.map(story => ({
      id: story.id,
      type: story.media.type,
      s3Key: story.media.s3Key
    }))
  });

  // Reset when modal opens/closes or story changes
  useEffect(() => {
    if (isOpen && stories.length > 0) {
      setCurrentStoryIndex(0);
      setProgress(0);
      setIsPaused(false);
      setPausedAt(null);
      setCurrentStoryDuration(5000); // Default duration for images
      startTimeRef.current = Date.now();
      // Reset swipe state
      setSwipeOffset(0);
      setIsSwipeActive(false);
    }
  }, [isOpen, stories.length]);

  // Handle story progression
  useEffect(() => {
    if (!isOpen || stories.length === 0) {
      return;
    }

    // Skip timer-based progression for videos - they handle their own progress
    if (currentStory?.media.type === 'video') {
      return;
    }

    // Calculate start time based on whether we're resuming from pause
    let effectiveStartTime = startTimeRef.current;
    if (pausedAt !== null) {
      const elapsedTime = (pausedAt / 100) * currentStoryDuration;
      effectiveStartTime = Date.now() - elapsedTime;
      startTimeRef.current = effectiveStartTime; // Update the ref so subsequent calculations are correct
    }
    
    const updateProgress = () => {
      // Skip updating if paused
      if (isPaused) {
        return;
      }
      
      const elapsed = Date.now() - effectiveStartTime;
      const newProgress = Math.min((elapsed / currentStoryDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        goToNextStory();
      }
    };

    progressIntervalRef.current = setInterval(updateProgress, 50);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentStoryIndex, isOpen, stories.length, currentStoryDuration, currentStory?.media.type, pausedAt]);

  // Auto-play video when story changes
  useEffect(() => {
    console.log('🎥 Video useEffect triggered', { 
      storyType: currentStory?.media.type, 
      currentStoryIndex, 
      isPaused, 
      isMuted 
    });
    
    if (currentStory?.media.type === 'video' && videoRef.current) {
      console.log('🎬 Setting up video', videoRef.current.currentTime);
      videoRef.current.currentTime = 0;
      videoRef.current.muted = isMuted;
      
      // Wait for video metadata to load to get duration
      const handleLoadedMetadata = () => {
        if (videoRef.current) {
          const videoDurationMs = videoRef.current.duration * 1000;
          console.log('Video duration detected:', videoDurationMs / 1000, 'seconds');
          setCurrentStoryDuration(videoDurationMs);
          setProgress(0);
        }
      };

      // Update progress based on video playback time
      const handleTimeUpdate = () => {
        if (videoRef.current && !isPaused && !videoRef.current.paused) {
          const currentTime = videoRef.current.currentTime;
          const duration = videoRef.current.duration;
          if (duration > 0) {
            const progressPercent = (currentTime / duration) * 100;
            setProgress(progressPercent);
            
            // Auto advance when video completes
            if (progressPercent >= 99.9) {
              goToNextStory();
            }
          }
        }
      };

      // Handle video pause events - removed to prevent conflicts with manual pause
      
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.play().catch(console.error);
      
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    } else if (currentStory?.media.type === 'image') {
      // For images, use default 5 second duration and reset timer
      setCurrentStoryDuration(5000);
      setIsPaused(false); // Ensure image stories start unpaused
      startTimeRef.current = Date.now();
      setProgress(0);
    }
  }, [currentStoryIndex, currentStory, isMuted]);

  const goToNextStory = useCallback(() => {
    setPausedAt(null); // Reset pause state when changing stories
    setIsPaused(false); // Ensure not paused when starting new story
    setProgress(0); // Reset progress for new story
    startTimeRef.current = Date.now(); // Reset timing for new story
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentStoryIndex, stories.length, onClose]);

  const goToPrevStory = useCallback(() => {
    setPausedAt(null); // Reset pause state when changing stories
    setIsPaused(false); // Ensure not paused when starting new story
    setProgress(0); // Reset progress for new story
    startTimeRef.current = Date.now(); // Reset timing for new story
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    }
  }, [currentStoryIndex]);

  const togglePause = useCallback(() => {
    console.log("togglePause called", { currentIsPaused: isPaused, storyType: currentStory?.media.type, currentProgress: progress });
    
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    // Handle video pause/play
    if (currentStory?.media.type === 'video' && videoRef.current) {
      if (newPausedState) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    } else if (currentStory?.media.type === 'image') {
      // For images, handle pause/resume
      if (newPausedState) {
        // Pausing - save current progress
        setPausedAt(progress);
      } else {
        // Resuming - clear pausedAt after a brief delay to let the effect handle the resume
        setTimeout(() => setPausedAt(null), 100);
      }
    }
  }, [isPaused, currentStory, progress]);

  const toggleMute = useCallback(() => {
    console.log("toggleMute called");
    setIsMuted(prev => !prev);
    
    // Update video mute state
    if (currentStory?.media.type === 'video' && videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted, currentStory]);

  // Touch/swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    setIsSwipeActive(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeActive) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY.current;
    const deltaX = Math.abs(touch.clientX - touchStartX.current);
    
    // Only allow vertical swipes (prevent horizontal interference)
    if (deltaX < 50 && deltaY > 0) {
      setSwipeOffset(deltaY);
      // Prevent default scrolling when swiping down
      e.preventDefault();
    }
  }, [isSwipeActive]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipeActive) return;
    
    const threshold = 100; // Minimum swipe distance to close
    
    if (swipeOffset > threshold) {
      // Close modal on sufficient swipe down
      onClose();
    } else {
      // Reset position if swipe wasn't enough
      setSwipeOffset(0);
    }
    
    setIsSwipeActive(false);
  }, [isSwipeActive, swipeOffset, onClose]);

  const handleLeftClick = useCallback(() => {
    goToPrevStory();
  }, [goToPrevStory]);

  const handleRightClick = useCallback(() => {
    goToNextStory();
  }, [goToNextStory]);

  const handleCenterTap = useCallback(() => {
    console.log("handleCenterTap called");
    
    togglePause();
  }, [togglePause]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        goToPrevStory();
        break;
      case 'ArrowRight':
        goToNextStory();
        break;
      case ' ':
        e.preventDefault();
        togglePause();
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [isOpen, goToPrevStory, goToNextStory, togglePause, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  if (!isOpen || !artStory || stories.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex items-center justify-center transition-transform duration-200 ease-out"
      style={{
        transform: isSwipeActive ? `translateY(${swipeOffset}px)` : 'translateY(0)',
        opacity: isSwipeActive ? Math.max(0.5, 1 - (swipeOffset / 300)) : 1
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with close button, title, and sound toggle */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
        {/* Close button */}
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors p-1 z-30"
        >
          <Image src="/close.svg" alt="Close" width={24} height={24} />
        </button>

        {/* Art Story title */}
        <div className="text-white text-lg  text-left flex-1 ml-1 mr-4 truncate">
          {artStory.title}
        </div>

        {/* Sound/Mute toggle */}
        <button
          onClick={toggleMute}
          className="text-white/80 hover:text-white transition-colors p-1 z-30"
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>

      {/* Progress bars */}
      <div className="absolute top-14 left-4 right-4 z-25 flex gap-1">
        {stories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{
                width: index < currentStoryIndex ? '100%' : 
                       index === currentStoryIndex ? `${progress}%` : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Current story title */}
      

      {/* Navigation areas */}
      <div 
        className="absolute left-0 top-0 w-1/4 h-full z-20 cursor-pointer"
        onClick={handleLeftClick}
      />
      <div 
        className="absolute left-1/4 top-0 w-1/2 h-full z-20 cursor-pointer"
        onClick={handleCenterTap}
      />
      <div 
        className="absolute right-0 top-0 w-1/4 h-full z-20 cursor-pointer"
        onClick={handleRightClick}
      />

      {/* Story content */}
      <div className="relative w-full h-full flex items-center justify-center">
        {currentStory?.media.type === 'image' ? (
          <div className="relative w-full h-full">
            <Image
              src={generateS3Url(currentStory.media.s3Key)}
              alt={currentStory.title || 'Story'}
              fill
              className="object-contain"
              priority
            />
          </div>
        ) : currentStory?.media.type === 'video' ? (
          <video
            key={`video-${currentStory.id}-${currentStoryIndex}`}
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            playsInline
            onEnded={goToNextStory}
            onPause={() => setIsPaused(true)}
            onPlay={() => setIsPaused(false)}
          >
            <source src={generateS3Url(currentStory.media.s3Key)} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : null}

        {/* Story description overlay */}
        {currentStory?.description && (
          <div className="absolute bottom-20 left-4 right-4 z-10">
            <p className="text-white text-center bg-black/50 p-4 rounded-lg">
              {currentStory.description}
            </p>
          </div>
        )}

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}