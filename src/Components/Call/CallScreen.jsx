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
  callDuration = 0
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
        return 'Ringing...';
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
          <div className="call-avatar">
            <img src={friend.photoURL} alt={friend.displayName} />
          </div>
          <h2 className="call-friend-name">{friend.displayName}</h2>
          <p className="call-status">
            {getStatusText()}
          </p>
          {getRingAnimation()}
          
          {/* Only show timer when call is active */}
          {callState === 'active' && isInCall && <CallTimer duration={callDuration} />}
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
          onEndCall={onEndCall}
          showAllControls={callState === 'active'}
        />
      </div>
    </div>
  );
};

export default CallScreen;