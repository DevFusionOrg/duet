import React, { useEffect, useRef } from 'react';
import '../../styles/Call.css';

const IncomingCallModal = ({ 
  callerName, 
  callerPhoto, 
  onAccept, 
  onDecline, 
  onClose 
}) => {
  const audioRef = useRef(null);

  // Play ringing sound with better handling
  useEffect(() => {
    try {
      audioRef.current = new Audio('/ringtone.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Ringtone play failed, trying fallback:', e);
          // Try different format or silent play
          const silentAudio = new Audio();
          silentAudio.play().catch(() => {});
        });
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  // Handle key events for accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onAccept();
      } else if (e.key === 'Escape') {
        onDecline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAccept, onDecline]);

  return (
    <div className="incoming-call-overlay" role="dialog" aria-labelledby="incoming-call-title">
      <div className="incoming-call-modal">
        <div className="caller-info">
          <div className="caller-avatar">
            <img src={callerPhoto} alt={callerName} />
          </div>
          <h2 id="incoming-call-title" className="caller-name">{callerName}</h2>
          <p className="call-type">Incoming Audio Call</p>
          <div className="ringing-animation">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div className="incoming-call-controls">
          <button 
            className="accept-call-button"
            onClick={onAccept}
            aria-label="Accept call"
            autoFocus
          >
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"></path>
            </svg>
          </button>

          <button 
            className="decline-call-button"
            onClick={onDecline}
            aria-label="Decline call"
          >
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;