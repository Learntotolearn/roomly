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
    audio.currentTime = newTime;
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

  return (
    <div className={cn("bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded p-0.5 text-white shadow-sm w-20", className)}>
      {/* Title */}
      {title && (
        <div className="text-xs font-medium text-gray-300 mb-0.5 truncate">
          {title}
        </div>
      )}

      {/* Waveform Visualization */}
      <div className="mb-0.5 bg-gray-900/50 rounded p-0.5">
        <div className="flex items-center justify-between h-2.5 gap-0.5">
          {Array.from({ length: 12 }, (_, i) => {
            const centerY = 1.25;
            const amplitude = 0.8;
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
      <div className="flex items-center gap-0.5 mb-0.5">
        <button
          onClick={togglePlay}
          className="w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-100 transition-colors"
          disabled={isLoading}
        >
          {isPlaying ? (
            <div className="w-0.5 h-0.5 bg-gray-800 rounded-sm" />
          ) : (
            <div className="w-0 h-0 border-l-0.5 border-l-gray-800 border-t-0.5 border-t-transparent border-b-0.5 border-b-transparent ml-0.5" />
          )}
        </button>
        
        <div className="flex-1">
          <div
            ref={progressRef}
            className="h-0.5 bg-gray-700 rounded-full cursor-pointer relative"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="text-xs text-gray-400 min-w-[0.75rem] text-right">
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Volume controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleMute}
          className="w-2 h-2 text-gray-400 hover:text-white transition-colors"
        >
          {isMuted || volume === 0 ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : volume < 0.5 ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
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
          className="flex-1 h-0.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        
        <div className="text-xs text-gray-400 min-w-[0.75rem] text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 3px;
          width: 3px;
          border-radius: 50%;
          background: #60a5fa;
          cursor: pointer;
          box-shadow: 0 0 2px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          height: 3px;
          width: 3px;
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


