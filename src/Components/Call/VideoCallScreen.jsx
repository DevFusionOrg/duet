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
  isMuted = false,
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
      } else if (localVideoRef.current) {
        await localVideoRef.current.requestPictureInPicture();
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
        {/* Main remote video */}
        <div className="remote-video-container">
          <video 
            ref={remoteVideoRef}
            className="remote-video"
            autoPlay
            playsInline
            muted={isSpeaker}
          />
          
          {/* Remote user info */}
          <div className="remote-user-info">
            <h2 className="remote-user-name">{friend?.displayName || 'Connecting...'}</h2>
            {callState === 'active' && <CallTimer duration={callDuration} />}
            
            {callState === 'active' && (
              <div className="connection-quality">
                <div 
                  className="quality-indicator" 
                  style={{ backgroundColor: getQualityColor(connectionQuality) }}
                />
                <span className="quality-text">
                  {connectionQuality === 'excellent' ? 'Excellent' :
                   connectionQuality === 'good' ? 'Good' :
                   connectionQuality === 'poor' ? 'Poor' : 'Very Poor'}
                </span>
              </div>
            )}
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
            muted
          />
          
          {/* Local video overlay */}
          <div className="local-video-overlay">
            {!isVideoEnabled && (
              <div className="camera-off-indicator">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M3.27 2L2 3.27L4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.2 0 .39-.08.53-.22l2.46 2.46L21 20.73 3.27 2zM20 6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.99L20 6z"/>
                </svg>
                <span>Camera Off</span>
              </div>
            )}
            
            {isMuted && (
              <div className="mic-off-indicator">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              </div>
            )}
            
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