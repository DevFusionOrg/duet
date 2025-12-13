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
    if (!incomingCall) return; // Don't play if no incoming call
    
    try {
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
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [incomingCall]); // Add incomingCall as dependency

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
          {isVideoCall ? (
            <div className="video-call-indicator">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#2196F3">
                <rect fill="none" height="18" rx="3" stroke="currentColor" strokeWidth="2" width="16.999" x="1" y="3"/>
                <path d="m17.999 9.146 2.495-2.256A1.5 1.5 0 0 1 23 8.003v7.994a1.5 1.5 0 0 1-2.506 1.113L18 14.854" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>Video Call</span>
            </div>
          ) : (
            <div className="audio-call-indicator">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4CAF50">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              <span>Audio Call</span>
            </div>
          )}
        </div>

        <div className="caller-info">
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
          <h2 id="incoming-call-title" className="caller-name">{callerName}</h2>
          <p className="call-type">
            {isVideoCall ? 'Incoming video call...' : 'Incoming audio call...'}
          </p>
          <div className="ringing-animation">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div className="incoming-call-controls">
          <div className="call-buttons-container">
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
          
          <div className="call-actions-labels">
            <span className="accept-label">Accept</span>
            <span className="decline-label">Decline</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;