import React, { useEffect, useRef } from 'react';
import '../../styles/Call.css';

const IncomingCallModal = ({ 
  callerName, 
  callerPhoto, 
  onAccept, 
  onDecline, 
  onClose,
  visible
}) => {
  const audioRef = useRef(null);

  // Play ringing sound with better handling
  useEffect(() => {
    if (!visible) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    try {
      audioRef.current = new Audio('/ringtone.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Ringtone play failed:', e);
          // Fallback to silent audio to prevent auto-play block
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
      }
    };
  }, [visible]);

  // Handle key events for accessibility
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onAccept();
      } else if (e.key === 'Escape') {
        onDecline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onAccept, onDecline]);

  // Auto decline after 45 seconds
  useEffect(() => {
    if (!visible) return;

    const timeout = setTimeout(() => {
      console.log('Call auto-declined after timeout');
      onDecline();
    }, 45000); // 45 seconds

    return () => clearTimeout(timeout);
  }, [visible, onDecline]);

  if (!visible) return null;

  return (
    <div className="incoming-call-overlay" role="dialog" aria-labelledby="incoming-call-title">
      <div className="incoming-call-modal">
        <button 
          className="close-call-modal"
          onClick={onClose}
          aria-label="Close call modal"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
        
        <div className="caller-info">
          <div className="caller-avatar">
            <img 
              src={callerPhoto || '/default-avatar.png'} 
              alt={callerName} 
              onError={(e) => {
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>
          <h2 id="incoming-call-title" className="caller-name">{callerName || 'Unknown Caller'}</h2>
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
            <div className="call-button-icon accept">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="white" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"></path>
              </svg>
            </div>
            <span className="call-button-text">Accept</span>
          </button>

          <button 
            className="decline-call-button"
            onClick={onDecline}
            aria-label="Decline call"
          >
            <div className="call-button-icon decline">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="white" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
              </svg>
            </div>
            <span className="call-button-text">Decline</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;