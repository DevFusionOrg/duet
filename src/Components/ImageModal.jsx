import React from 'react';
import '../styles/ImageModal.css';

function ImageModal({ imageUrl, imageAlt, onClose }) {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!imageUrl) return null;

  return (
    <div className="image-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-modal-container">
        <button className="image-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img
          src={imageUrl}
          alt={imageAlt || 'Full size image'}
          className="image-modal-image"
          onError={(e) => {
            e.currentTarget.src = '/default-avatar.png';
          }}
        />
      </div>
    </div>
  );
}

export default ImageModal;
