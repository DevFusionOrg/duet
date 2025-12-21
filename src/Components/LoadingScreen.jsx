import React from 'react';
import '../styles/LoadingScreen.css';

const LoadingScreen = ({ message = 'Loading', fullScreen = false, size = 'medium' }) => {
  return (
    <div className={`loading-screen ${fullScreen ? 'fullscreen' : ''} ${size}`}>
      <div className="loading-container">
        <div className="spinner-wrapper medium">
          <svg className="spinner-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gradientSpinnerLoading" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#gradientSpinnerLoading)"
              strokeWidth="3"
              strokeDasharray="70.7 282.8"
              strokeLinecap="round"
              className="spinner-circle"
            />
          </svg>
        </div>
        <div className="loading-text">{message}</div>
      </div>
    </div>
  );
};

export default LoadingScreen;
