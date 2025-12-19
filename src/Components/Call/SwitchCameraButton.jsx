import React, { useState } from 'react';

const SwitchCameraButton = ({ onSwitch }) => {
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const handleSwitch = () => {
    const newMode = isFrontCamera ? 'environment' : 'user';
    onSwitch(newMode);
    setIsFrontCamera(!isFrontCamera);
  };

  return (
    <button 
      className="switch-camera-button"
      onClick={handleSwitch}
      aria-label={isFrontCamera ? "Switch to back camera" : "Switch to front camera"}
      title={isFrontCamera ? "Back Camera" : "Front Camera"}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {}
        <path 
          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
          stroke="currentColor" 
          strokeWidth="2"
        />
        <path 
          d="M16 8L20 12L16 16" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        <path 
          d="M8 8L4 12L8 16" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        {}
        <circle 
          cx="12" 
          cy="12" 
          r="3" 
          fill={isFrontCamera ? "transparent" : "currentColor"}
          stroke="currentColor" 
          strokeWidth="1"
        />
      </svg>
    </button>
  );
};

export default SwitchCameraButton;