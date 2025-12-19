import React from 'react';

const CameraToggle = ({ isVideoEnabled, onToggle }) => {
  return (
    <button 
      className={`camera-toggle-button ${isVideoEnabled ? 'camera-on' : 'camera-off'}`}
      onClick={onToggle}
      aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      title={isVideoEnabled ? "Camera On" : "Camera Off"}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        {isVideoEnabled ? (
          
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        ) : (
          
          <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27l4.73 4.73L4 8v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
        )}
      </svg>
    </button>
  );
};

export default CameraToggle;