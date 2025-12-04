import React, { useState, useEffect, useRef } from 'react';
import CallControls from './CallControls';
import CallTimer from './CallTimer';
import '../../styles/Call.css';

const CallScreen = ({ 
  friend, 
  callState, // 'ringing' | 'connecting' | 'active' | 'ended'
  onEndCall, 
  onToggleMute, 
  onToggleSpeaker,
  callDuration = 0,
  isInitiator = true // Add this prop
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    // Set up audio elements
    if (localAudioRef.current) {
      localAudioRef.current.volume = 0.3;
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = 1.0;
    }
  }, []);

  // Handle end call with confirmation if call just started
  const handleEndCallWithConfirm = () => {
    if (callState === 'active' && callDuration < 10) {
      const confirm = window.confirm('End the call?');
      if (!confirm) return;
    }
    onEndCall();
  };

  const handleMuteToggle = () => {
    const muted = onToggleMute();
    setIsMuted(muted);
  };

  const handleSpeakerToggle = () => {
    const speakerEnabled = onToggleSpeaker();
    setIsSpeaker(speakerEnabled);
  };

  const getStatusText = () => {
    switch(callState) {
      case 'ringing':
        return isInitiator ? 'Calling...' : 'Incoming call...';
      case 'connecting':
        return 'Connecting...';
      case 'active':
        return 'Audio call';
      case 'ended':
        return 'Call ended';
      default:
        return 'Audio call';
    }
  };

  const getRingAnimation = () => {
    if (callState === 'ringing' || callState === 'connecting') {
      return (
        <div className="ringing-animation">
          <span></span>
          <span></span>
          <span></span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="call-screen-overlay">
      <div className="call-screen">
        {/* Call info */}
        <div className="call-info">
          <h2 className="call-friend-name">{friend.displayName}</h2>
          
          {/* Only show timer when call is active */}
          {callState === 'active' && <CallTimer duration={callDuration} />}
          
          {/* Show call quality indicator */}
          {callState === 'active' && (
            <div className="call-quality-indicator">
              <span className="quality-dot good"></span>
            </div>
          )}
        </div>

        {/* Audio elements */}
        <audio ref={localAudioRef} className="local-audio" muted />
        <audio ref={remoteAudioRef} className="remote-audio" autoPlay />

        {/* Call controls - show even during ringing/connecting */}
        <CallControls
          isMuted={isMuted}
          isSpeaker={isSpeaker}
          onMuteToggle={handleMuteToggle}
          onSpeakerToggle={handleSpeakerToggle}
          onEndCall={handleEndCallWithConfirm} // Use the new function
          showAllControls={callState === 'active'}
          showEndButton={true} // Always show end button
        />
      </div>
    </div>
  );
};

export default CallScreen;