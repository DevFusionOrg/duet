import React, { useState, useEffect } from 'react';
import { secureOriginCheck } from '../utils/secureOriginCheck';
import '../styles/SecurityWarning.css';

function SecurityWarning() {
  const [warning, setWarning] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const warningInfo = secureOriginCheck.getWarningMessage();
    if (warningInfo) {
      setWarning(warningInfo);

      const dismissedKey = `security-warning-dismissed-${window.location.hostname}`;
      const wasDismissed = localStorage.getItem(dismissedKey);
      if (wasDismissed) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    const dismissedKey = `security-warning-dismissed-${window.location.hostname}`;
    localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  };

  const handleShowInstructions = () => {
    setShowInstructions(true);
  };

  if (!warning || dismissed) {
    return null;
  }

  const instructions = secureOriginCheck.getBrowserInstructions();

  return (
    <>
      <div className="security-warning-banner">
        <div className="security-warning-content">
          <div className="security-warning-icon">⚠️</div>
          <div className="security-warning-text">
            <strong>{warning.title}</strong>
            <p>{warning.message}</p>
            <p className="security-warning-solution">
              <strong>Solution:</strong> Access via{' '}
              <a 
                href={window.location.origin.replace(window.location.hostname, 'localhost')}
                className="security-warning-link"
              >
                http:
              </a>
              {' '}instead, or{' '}
              <button 
                onClick={handleShowInstructions}
                className="security-warning-instructions-btn"
              >
                click here for browser setup instructions
              </button>
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="security-warning-close"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="security-instructions-modal" onClick={() => setShowInstructions(false)}>
          <div className="security-instructions-content" onClick={(e) => e.stopPropagation()}>
            <div className="security-instructions-header">
              <h3>Enable Permissions for {window.location.hostname}</h3>
              <button 
                onClick={() => setShowInstructions(false)}
                className="security-instructions-close"
              >
                ×
              </button>
            </div>
            
            <div className="security-instructions-body">
              <div className="security-instructions-section">
                <h4>Browser: {instructions.browser}</h4>
                <div className="security-instructions-steps">
                  {instructions.steps.map((step, index) => (
                    <div key={index} className="security-instruction-step">
                      <span className="step-number">{index + 1}</span>
                      <span className="step-text">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {instructions.shortUrl && (
                <div className="security-instructions-quick">
                  <strong>Quick Link:</strong>
                  <input 
                    type="text" 
                    value={instructions.shortUrl}
                    readOnly
                    className="security-instructions-url"
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(instructions.shortUrl);
                      alert('Copied to clipboard!');
                    }}
                    className="security-instructions-copy"
                  >
                    Copy
                  </button>
                </div>
              )}

              {instructions.alternativeSteps && (
                <div className="security-instructions-alternative">
                  <h4>Alternative Method:</h4>
                  {instructions.alternativeSteps.map((step, index) => (
                    <p key={index}>{step}</p>
                  ))}
                </div>
              )}

              <div className="security-instructions-recommended">
                <strong>⭐ Recommended:</strong> Access via{' '}
                <a 
                  href={window.location.origin.replace(window.location.hostname, 'localhost')}
                  className="security-instructions-link"
                >
                  http:
                </a>
                {' '}for best experience without browser configuration.
              </div>
            </div>

            <div className="security-instructions-footer">
              <button 
                onClick={() => setShowInstructions(false)}
                className="security-instructions-done"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SecurityWarning;
