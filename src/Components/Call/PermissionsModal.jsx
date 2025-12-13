import React from 'react';
import '../../styles/VideoCall.css';

const PermissionsModal = ({ 
  isOpen, 
  onClose, 
  onAllow, 
  missingPermissions,
  errorType = null 
}) => {
  if (!isOpen) return null;

  const getErrorDetails = () => {
    if (!errorType) return null;
    
    const errors = {
      'NotAllowedError': {
        title: 'Permission Denied',
        message: 'Camera/microphone access was denied.',
        steps: [
          'Click the camera/microphone icon in your browser address bar',
          'Select "Allow" or "Always allow" for this site',
          'Refresh the page and try again'
        ]
      },
      'NotFoundError': {
        title: 'No Camera/Microphone Found',
        message: 'No camera or microphone was detected.',
        steps: [
          'Check if your camera/microphone is connected properly',
          'Make sure no other app is using the camera/microphone',
          'Try using a different device'
        ]
      },
      'NotReadableError': {
        title: 'Device in Use',
        message: 'Camera/microphone is being used by another application.',
        steps: [
          'Close other apps that might be using the camera/microphone',
          'Restart your browser',
          'Try a different browser'
        ]
      },
      'default': {
        title: 'Permission Required',
        message: 'Camera and microphone access is required for video calls.',
        steps: [
          'Click "Allow Access" to grant permissions',
          'If prompted, allow access in the browser dialog',
          'Make sure you\'re using HTTPS'
        ]
      }
    };

    return errors[errorType] || errors.default;
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="permissions-modal-overlay">
      <div className="permissions-modal">
        <div className="permissions-header">
          <h3>{errorDetails?.title || 'Camera & Microphone Access'}</h3>
          <button className="permissions-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="permissions-content">
          <div className="permissions-icons">
            {missingPermissions?.camera && (
              <div className="permission-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                <span>Camera</span>
              </div>
            )}
            
            {missingPermissions?.microphone && (
              <div className="permission-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
                </svg>
                <span>Microphone</span>
              </div>
            )}
          </div>

          <p className="permissions-message">
            {errorDetails?.message || 'Duet needs access to your camera and microphone for video calls.'}
          </p>

          {errorDetails?.steps && (
            <div className="permissions-steps">
              <h4>How to fix:</h4>
              <ol>
                {errorDetails.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="permissions-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            <span>You can change permissions later in your browser settings</span>
          </div>
        </div>

        <div className="permissions-actions">
          <button 
            className="permissions-btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="permissions-btn primary"
            onClick={onAllow}
          >
            Allow Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsModal;