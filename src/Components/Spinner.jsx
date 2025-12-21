import React from 'react';
import '../styles/LoadingScreen.css';

export const Spinner = ({ size = 'medium', inline = false }) => {
  const svgSpinner = (
    <div className={`spinner-wrapper ${size}`}>
      <svg className="spinner-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`gradientSpinner${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#gradientSpinner${size})`}
          strokeWidth="3"
          strokeDasharray="70.7 282.8"
          strokeLinecap="round"
          className="spinner-circle"
        />
      </svg>
    </div>
  );

  if (inline) {
    return (
      <div className="loading-inline">
        {svgSpinner}
        <span>Loading...</span>
      </div>
    );
  }

  return svgSpinner;
};

export const SkeletonLoader = ({ lines = 3, width = '100%' }) => {
  return (
    <div style={{ width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-loader"></div>
      ))}
    </div>
  );
};

export default Spinner;
