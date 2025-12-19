import React from 'react';
import '../../styles/EncryptionIndicator.css';

const EncryptionIndicator = ({ small = false }) => {
  return (
    <div className={`encryption-indicator ${small ? 'small' : ''}`} title="End-to-end encrypted">
      <svg 
        width={small ? "12" : "14"} 
        height={small ? "12" : "14"} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <path 
          d="M9 12L11 14L15 10" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {!small && <span>End-to-end encrypted</span>}
    </div>
  );
};

export default EncryptionIndicator;
