import React from 'react';

const VideoCallButton = ({ onClick, disabled = false, title = "Video Call" }) => {
  return (
    <button 
      className="video-call-button chat-header-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label="Video call"
    >
      <svg 
        aria-label="Video call" 
        className="video-call-icon" 
        fill="currentColor" 
        height="24" 
        viewBox="0 0 24 24" 
        width="24"
      >
        <rect 
          fill="none" 
          height="18" 
          rx="3" 
          stroke="currentColor" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          width="16.999" 
          x="1" 
          y="3"
        />
        <path 
          d="m17.999 9.146 2.495-2.256A1.5 1.5 0 0 1 23 8.003v7.994a1.5 1.5 0 0 1-2.506 1.113L18 14.854" 
          fill="none" 
          stroke="currentColor" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2"
        />
      </svg>
    </button>
  );
};

export default VideoCallButton;