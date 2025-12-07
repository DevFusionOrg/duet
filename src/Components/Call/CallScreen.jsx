import React, { useState, useEffect, useRef } from 'react';
import CallControls from './CallControls';
import CallTimer from './CallTimer';
import '../../styles/Call.css';

const CallScreen = ({ 
  friend, 
  callState,
  onEndCall, 
  onToggleMute, 
  onToggleSpeaker,
  callDuration = 0,
  isInitiator = true
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localAudioRef.current) {
      localAudioRef.current.volume = 0.3;
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = 1.0;
    }
  }, []);

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

  return (
    <div className="call-screen-overlay">
      <div className="call-screen">
        <div className="call-info">
          <h2 className="call-friend-name">{friend.displayName}</h2>
          
          {callState === 'active' && <CallTimer duration={callDuration} />}
          
          {callState === 'active' && (
            <div className="call-quality-indicator">
              <span className="quality-dot good"></span>
            </div>
          )}
        </div>

        <audio ref={localAudioRef} className="local-audio" muted />
        <audio ref={remoteAudioRef} className="remote-audio" autoPlay />

        <CallControls
          isMuted={isMuted}
          isSpeaker={isSpeaker}
          onMuteToggle={handleMuteToggle}
          onSpeakerToggle={handleSpeakerToggle}
          onEndCall={handleEndCallWithConfirm}
          showAllControls={callState === 'active'}
          showEndButton={true}
        />
      </div>
    </div>
  );
};

export default CallScreen;