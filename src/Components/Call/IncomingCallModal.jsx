import React, { useEffect, useRef } from 'react';
import '../../styles/Call.css';

const IncomingCallModal = ({ 
  incomingCall, 
  onAccept, 
  onDecline,
  isVideoCall = false,
  friend = null
}) => {
  const audioRef = useRef(null);
  
  // Use incomingCall data or friend prop
  const callerName = incomingCall?.callerName || friend?.displayName || 'Unknown';
  const callerPhoto = incomingCall?.callerPhoto || friend?.photoURL;

  // Play ringing sound with better handling
  useEffect(() => {
    if (!incomingCall) {
      // Stop audio when modal closes
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          console.error('Error stopping audio:', e);
        }
      }
      return;
    }
    
    try {
      // Stop any existing audio first
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      audioRef.current = new Audio('/ringtone.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Ringtone play failed, trying fallback:', e);
          const silentAudio = new Audio();
          silentAudio.play().catch(() => {});
        });
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
    
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          console.error('Error in cleanup:', e);
        }
      }
    };
  }, [incomingCall]);

  // Handle key events for accessibility
  useEffect(() => {
    if (!incomingCall) return; // Don't add listeners if no incoming call
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onAccept();
      } else if (e.key === 'Escape') {
        onDecline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incomingCall, onAccept, onDecline]);

  // Early return AFTER hooks
  if (!incomingCall) return null;

  return (
    <div className="incoming-call-overlay" role="dialog" aria-labelledby="incoming-call-title">
      <div className="incoming-call-modal">
        <div className="incoming-call-header">
          <h3>{isVideoCall ? 'Video Call' : 'Audio Call'}</h3>
          
          <div className="caller-avatar">
            <img 
              src={callerPhoto || '/default-avatar.png'} 
              alt={callerName}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>
          
          <div className="caller-name">{callerName}</div>
          <div className="call-status-text">
            {isVideoCall ? 'Incoming video call...' : 'Incoming audio call...'}
          </div>
          
          <div className="ringing-animation">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        {/* Updated: This matches the CSS structure */}
        <div className="incoming-call-controls">
          {/* Decline button container */}
          <div className="call-button-container">
            <button 
              className="decline-call-button"
              onClick={onDecline}
              aria-label="Decline call"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <span className="call-button-label">Decline</span>
          </div>
          
          {/* Accept button container */}
          <div className="call-button-container">
            <button 
              className="accept-call-button"
              onClick={onAccept}
              aria-label="Accept call"
              autoFocus
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </button>
            <span className="call-button-label">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;