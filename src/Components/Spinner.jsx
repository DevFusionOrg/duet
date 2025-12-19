import React from 'react';
import '../styles/LoadingScreen.css';

export const Spinner = ({ size = 'medium', inline = false }) => {
  const className = `loading-spinner-${size}`;
  
  if (inline) {
    return (
      <div className="loading-inline">
        <div className="spinner-small"></div>
        <span>Loading...</span>
      </div>
    );
  }

  return <div className={className}></div>;
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
