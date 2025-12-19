import React, { useState, useRef, useEffect } from 'react';
import { Spinner } from '../Spinner';

function VoiceNotePlayer({ voiceUrl, duration: initialDuration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    
    const audio = new Audio(voiceUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };

    audio.onerror = () => {
      console.error('Error loading voice note');
      setIsLoading(false);
    };

    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [voiceUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current || isLoading) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="voice-note-player">
      <button 
        className="voice-note-play-btn"
        onClick={handlePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <Spinner size="small" inline={true} />
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      
      <div className="voice-note-info">
        <div className="voice-note-progress">
          <div 
            className="voice-note-progress-fill"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="voice-note-duration">
          {formatTime(isPlaying ? currentTime : duration)}
        </div>
      </div>
    </div>
  );
}

export default VoiceNotePlayer;
