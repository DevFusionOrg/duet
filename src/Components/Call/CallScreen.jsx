import React, { useState, useEffect, useRef } from 'react';
import CallControls from './CallControls';
import VideoCallScreen from './VideoCallScreen';
import CallTimer from './CallTimer';
import '../../styles/Call.css';

const CallScreen = ({ 
  friend, 
  callState,
  onEndCall, 
  onToggleMute, 
  onToggleVideo,
  onSwitchCamera,
  onToggleSpeaker,
  callDuration = 0,
  isInitiator = true,
  isSpeaker,
  isVideoCall = false,
  localStream = null,
  remoteStream = null,
  isVideoEnabled = true,
  isAudioEnabled = true,
  isFrontCamera = true,
  connectionQuality = 'good'
}) => {
  const [isMuted, setIsMuted] = useState(false);
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

  // Handle video streams
  useEffect(() => {
    if (isVideoCall && localStream && remoteStream) {
      // Video call - streams are handled by VideoCallScreen
      return;
    }
    
    // Audio call - handle audio streams
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.log('Audio play error:', e));
    }
  }, [isVideoCall, localStream, remoteStream]);

  const handleEndCallWithConfirm = () => {
    if (callState === 'active' && callDuration < 10) {
      const confirm = window.confirm(`End the ${isVideoCall ? 'video ' : ''}call?`);
      if (!confirm) return;
    }
    onEndCall();
  };

  const handleMuteToggle = () => {
    const muted = onToggleMute();
    setIsMuted(muted);
  };

  const handleVideoToggle = () => {
    if (onToggleVideo) {
      const videoEnabled = onToggleVideo();
      // State is managed by parent for video calls
    }
  };

  // Render video call screen
  if (isVideoCall) {
    return (
      <VideoCallScreen
        friend={friend}
        callState={callState}
        onEndCall={handleEndCallWithConfirm}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onSwitchCamera={onSwitchCamera}
        callDuration={callDuration}
        localStream={localStream}
        remoteStream={remoteStream}
        isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          isMuted={!isAudioEnabled}
        isSpeaker={isSpeaker}
        isFrontCamera={isFrontCamera}
        isInitiator={isInitiator}
        connectionQuality={connectionQuality}
      />
    );
  }

  // Render audio call screen (existing code)
  return (
    <div className="call-screen-overlay">
      <div className="call-screen">
        <div className="call-info">
          <h2 className="call-friend-name">{friend.displayName}</h2>
          
          {callState === 'active' && isInitiator && <CallTimer duration={callDuration} />}
          
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
          onSpeakerToggle={onToggleSpeaker}
          onEndCall={handleEndCallWithConfirm}
          showAllControls={callState === 'active'}
          showEndButton={true}
        />
      </div>
    </div>
  );
};

export default CallScreen;