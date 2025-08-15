'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressWidth = rect.width;
    const newTime = (clickX / progressWidth) * duration;
    
    // 确保时间在有效范围内
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    audio.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = progress.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progressWidth = rect.width;
      const newTime = (clickX / progressWidth) * duration;
      
      const clampedTime = Math.max(0, Math.min(duration, newTime));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 立即处理点击位置
    handleProgressClick(e);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // const [isDragging, setIsDragging] = useState(false); // Removed as per edit hint
  // const [dragStartTime, setDragStartTime] = useState(0); // Removed as per edit hint
  // const [dragStartCurrentTime, setDragStartCurrentTime] = useState(0); // Removed as per edit hint

  return (
    <div className={cn("bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded p-1 text-white shadow-sm w-24", className)}>
      {/* Title */}
      {title && (
        <div className="text-xs font-medium text-gray-300 mb-1 truncate">
          {title}
        </div>
      )}

      {/* Waveform Visualization */}
      <div className="mb-1 bg-gray-900/50 rounded p-0.5">
        <div className="flex items-center justify-between h-3 gap-0.5">
          {Array.from({ length: 12 }, (_, i) => {
            const centerY = 1.5;
            const amplitude = 1;
            const frequency = 0.3;
            const phase = i * 0.2;
            const time = Date.now() * 0.001;
            
            const wave = Math.sin(frequency * i + phase + time) * amplitude;
            const isActive = isPlaying && i < (currentTime / duration) * 12;
            
            const topHeight = Math.max(0.5, centerY + wave);
            const bottomHeight = Math.max(0.5, centerY - wave);
            
            return (
              <div key={i} className="flex flex-col items-center justify-center h-full">
                {/* Top half */}
                <div 
                  className={`w-0.5 rounded-full transition-all duration-100 ${
                    isActive ? 'bg-blue-400' : 'bg-gray-500'
                  }`}
                  style={{ 
                    height: `${topHeight}px`,
                    opacity: isActive ? 1 : 0.6
                  }}
                />
                {/* Bottom half */}
                <div 
                  className={`w-0.5 rounded-full transition-all duration-100 ${
                    isActive ? 'bg-blue-400' : 'bg-gray-500'
                  }`}
                  style={{ 
                    height: `${bottomHeight}px`,
                    opacity: isActive ? 1 : 0.6
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-1 mb-1">
        {/* Rewind button */}
        <button
          onClick={() => {
            const audio = audioRef.current;
            if (audio) {
              const newTime = Math.max(0, currentTime - 10);
              audio.currentTime = newTime;
              setCurrentTime(newTime);
            }
          }}
          className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-500 transition-colors"
          title="快退10秒"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </button>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="w-6 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
          disabled={isLoading}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Fast forward button */}
        <button
          onClick={() => {
            const audio = audioRef.current;
            if (audio) {
              const newTime = Math.min(duration, currentTime + 10);
              audio.currentTime = newTime;
              setCurrentTime(newTime);
            }
          }}
          className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-500 transition-colors"
          title="快进10秒"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
          </svg>
        </button>
        
        <div className="flex-1">
          <div
            ref={progressRef}
            className="h-1 bg-gray-700 rounded-full cursor-pointer relative group"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
          >
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-100 relative"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              {/* Progress thumb */}
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 min-w-[1.5rem] text-right">
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Volume controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="w-4 h-4 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
        >
          {isMuted || volume === 0 ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : volume < 0.5 ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          )}
        </button>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        
        <div className="text-xs text-gray-400 min-w-[1.5rem] text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 4px;
          width: 4px;
          border-radius: 50%;
          background: #60a5fa;
          cursor: pointer;
          box-shadow: 0 0 2px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          height: 4px;
          width: 4px;
          border-radius: 50%;
          background: #60a5fa;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};


