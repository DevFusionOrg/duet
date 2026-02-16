import React from 'react';
import '../../styles/Home.css';

function WelcomeOnboarding({ user, onSwitchToSearch }) {
  return (
    <div className="welcome-onboarding">
      <div className="welcome-header">
      </div>

      <div className="welcome-content">
        <div className="welcome-section">
          <div className="welcome-icon">👋</div>
            <div className="welcome-actions"></div>
            <button className="welcome-primary-btn"
              onClick={onSwitchToSearch}
            >
              Add Friends
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeOnboarding;