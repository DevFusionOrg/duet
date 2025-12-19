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
      {}
      <div className="quality-indicator-wrapper">
        <div className={`quality-dot ${connectionQuality}`} />
        <span className="quality-label">
          {connectionQuality === 'excellent' ? 'Excellent' :
           connectionQuality === 'good' ? 'Good' :
           connectionQuality === 'poor' ? 'Poor' : 'Very Poor'}
        </span>
        {isMuted && (
          <span className="mic-status-label" title="Microphone is muted">Mic Off</span>
        )}
      </div>

      {}
      <div className="video-controls-main">
        {}
        {showAllControls && (
          <button 
            className={`video-control-button ${isMuted ? 'video-control-muted' : 'video-control-unmuted'}`}
            onClick={onMuteToggle}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              {isMuted ? (
                
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
              ) : (
                
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              )}
            </svg>
          </button>
        )}

        {}
        {showAllControls && (
          <CameraToggle 
            isVideoEnabled={isVideoEnabled}
            onToggle={onVideoToggle}
          />
        )}

        {}
        {showAllControls && (
          <SwitchCameraButton onSwitch={onSwitchCamera} />
        )}

        {}
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

      {}
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