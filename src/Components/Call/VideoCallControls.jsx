import React from 'react';
import CameraToggle from './CameraToggle';
import SwitchCameraButton from './SwitchCameraButton';
import '../../styles/VideoCall.css';

const VideoCallControls = ({ 
  isMuted, 
  isVideoEnabled,
  isSpeaker,
  onMuteToggle, 
  onVideoToggle,
  onSpeakerToggle,
  onSwitchCamera,
  onEndCall,
  onTogglePIP,
  showAllControls = true,
  connectionQuality = 'good'
}) => {
  return (
    <div className="video-call-controls">
      {/* Quality indicator */}
      <div className="quality-indicator-wrapper">
        <div className={`quality-dot ${connectionQuality}`} />
        <span className="quality-label">
          {connectionQuality === 'excellent' ? 'Excellent' :
           connectionQuality === 'good' ? 'Good' :
           connectionQuality === 'poor' ? 'Poor' : 'Very Poor'}
        </span>
      </div>

      {/* Main controls */}
      <div className="video-controls-main">
        {/* Mute button */}
        {showAllControls && (
          <button 
            className={`video-control-button ${isMuted ? 'video-control-muted' : 'video-control-unmuted'}`}
            onClick={onMuteToggle}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              {isMuted ? (
                <path d="M12 4L9.91 6.09 12 8.18M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z"/>
              ) : (
                <path d="M12 2C9.01 2 6.28 3.08 4.17 4.88L5.64 6.35C7.44 4.83 9.57 4 12 4c4.41 0 8 3.59 8 8 0 1.48-.4 2.86-1.1 4.06l1.46 1.46C21.39 15.93 22 14.04 22 12c0-5.52-4.48-10-10-10zM5.17 16.59C4.2 15.32 3.5 13.73 3.5 12c0-1.17.27-2.27.74-3.25l1.46 1.46C5.4 10.63 5 11.29 5 12c0 1.38.56 2.63 1.46 3.54l-1.29 1.05zM12 6.5c-1.38 0-2.63.56-3.54 1.46l1.29 1.05C10.32 8.61 11.11 8.5 12 8.5c1.93 0 3.5 1.57 3.5 3.5 0 .89-.21 1.68-.54 2.43l1.46 1.46c.69-1.21 1.08-2.59 1.08-4.06 0-3.86-3.14-7-7-7z"/>
              )}
            </svg>
          </button>
        )}

        {/* Video toggle */}
        {showAllControls && (
          <CameraToggle 
            isVideoEnabled={isVideoEnabled}
            onToggle={onVideoToggle}
          />
        )}

        {/* Switch camera */}
        {showAllControls && (
          <SwitchCameraButton onSwitch={onSwitchCamera} />
        )}

        {/* Picture-in-Picture */}
        {showAllControls && document.pictureInPictureEnabled && (
          <button 
            className="video-control-button pip-button"
            onClick={onTogglePIP}
            aria-label="Toggle Picture-in-Picture"
            title="Picture-in-Picture"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 7h-8v8h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
            </svg>
          </button>
        )}
      </div>

      {/* End call button */}
      <button 
        className="video-control-button video-end-button"
        onClick={onEndCall}
        aria-label="End call"
        title="End Call"
      >
        <svg width="28" height="28" viewBox="0 0 36 36" fill="white">
          <path d="M4.865 18.073c-.522 1.043-.396 2.26-.146 3.4a2.12 2.12 0 0 0 1.547 1.602c.403.099.812.175 1.234.175 1.276 0 2.505-.2 3.659-.568.642-.205 1.085-.775 1.206-1.438l.472-2.599a.488.488 0 0 1 .28-.36A11.959 11.959 0 0 1 18 17.25c1.739 0 3.392.37 4.883 1.035.148.066.251.202.28.36l.472 2.599c.12.663.564 1.233 1.206 1.438 1.154.369 2.383.568 3.66.568.421 0 .83-.077 1.233-.175a2.12 2.12 0 0 0 1.547-1.601c.25-1.14.377-2.358-.146-3.401-1.722-3.44-7.06-5.323-13.135-5.323S6.587 14.633 4.865 18.073z"/>
        </svg>
      </button>
    </div>
  );
};

export default VideoCallControls;