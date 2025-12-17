import React, { useEffect, useRef, useState } from 'react';
import VideoCallControls from './VideoCallControls';
import CallTimer from './CallTimer';
import '../../styles/VideoCall.css';

const VideoCallScreen = ({ 
  friend, 
  callState,
  onEndCall, 
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  callDuration = 0,
  localStream,
  remoteStream,
  isMuted = false, // Ensure isMuted prop is defined and defaults to false
  isVideoEnabled = true,
  isSpeaker = false,
  isInitiator = true,
  connectionQuality = 'good'
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isLocalPIP, setIsLocalPIP] = useState(false);
  const [localVideoPosition, setLocalVideoPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Set video streams
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
    }
  }, [remoteStream]);

  // Handle local video drag (mobile-friendly)
  const handleDragStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    
    if (e.type === 'touchstart') {
      const touch = e.touches[0];
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      });
    } else {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    let clientX, clientY;
    
    if (e.type === 'touchmove') {
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;

    // Keep within screen bounds
    const maxX = window.innerWidth - 120; // Account for video width
    const maxY = window.innerHeight - 160; // Account for video height + controls
    
    const boundedX = Math.max(10, Math.min(newX, maxX));
    const boundedY = Math.max(10, Math.min(newY, maxY));

    setLocalVideoPosition({ x: boundedX, y: boundedY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Handle picture-in-picture
  const handleTogglePIP = async () => {
    if (!document.pictureInPictureEnabled) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsLocalPIP(false);
      } else if (remoteVideoRef.current) {
        await remoteVideoRef.current.requestPictureInPicture();
        setIsLocalPIP(true);
      }
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
    }
  };

  // Connection quality indicator
  const getQualityColor = (quality) => {
    switch(quality) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'poor': return '#FF9800';
      case 'very-poor': return '#F44336';
      default: return '#8BC34A';
    }
  };

  // Handle end call with confirmation for short calls
  const handleEndCallWithConfirm = () => {
    if (callState === 'active' && callDuration < 10) {
      const confirm = window.confirm('End the video call?');
      if (!confirm) return;
    }
    onEndCall();
  };

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
    } else {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  return (
    <div className="video-call-screen-overlay">
      <div className="video-call-screen">
        {/* Main remote video (fullscreen) */}
        <div className="remote-video-container">
          <video 
            ref={remoteVideoRef}
            className="remote-video"
            autoPlay
            playsInline
            // Do NOT mute remote video; we need to hear the other user
            muted={false}
          />
          
          {/* Remote user info */}
          <div className="remote-user-info">
            <h2 className="remote-user-name">{friend?.displayName || 'User'}</h2>
            {callState === 'active' && isInitiator && <div className="call-timer"><CallTimer duration={callDuration} /></div>}
          </div>
        </div>

        {/* Local video - Picture-in-Picture */}
        <div 
          className={`local-video-container ${isDragging ? 'dragging' : ''}`}
          style={{
            left: `${localVideoPosition.x}px`,
            top: `${localVideoPosition.y}px`
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <video 
            ref={localVideoRef}
            className="local-video"
            autoPlay
            playsInline
            muted={isSpeaker}
          />
          
          {/* Local user info in PiP */}
          <div className="local-video-overlay">
            <h3 className="pip-user-name">You</h3>
            
            <button 
              className="pip-toggle-btn"
              onClick={handleTogglePIP}
              title="Toggle Picture-in-Picture"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M19 7h-8v8h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Video Call Controls */}
        <VideoCallControls
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          isSpeaker={isSpeaker}
          onMuteToggle={onToggleMute}
          onVideoToggle={onToggleVideo}
          onSpeakerToggle={() => {}}
          onSwitchCamera={onSwitchCamera}
          onEndCall={handleEndCallWithConfirm}
          onTogglePIP={handleTogglePIP}
          showAllControls={callState === 'active'}
          connectionQuality={connectionQuality}
        />

        {/* Connection status */}
        {callState === 'connecting' && (
          <div className="connecting-overlay">
            <div className="connecting-spinner"></div>
            <p>Connecting to {friend?.displayName}...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallScreen;