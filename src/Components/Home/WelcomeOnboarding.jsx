import React from 'react';
import '../../styles/Home.css';

function WelcomeOnboarding({ user, onSwitchToSearch }) {
  return (
    <div className="welcome-onboarding">
      <div className="welcome-header">
        <h1 className="welcome-title">Welcome to Duet! 🎉</h1>
        <p className="welcome-subtitle">Your private messaging app</p>
      </div>

      <div className="welcome-content">
        <div className="welcome-section">
          <div className="welcome-icon">👋</div>
          <h3>Get Started</h3>
          <p>Connect with friends and start chatting privately</p>
        </div>

        <div className="welcome-section">
          <div className="welcome-icon">🔍</div>
          <h3>Find Friends</h3>
          <p>Search for friends by their username to start conversations</p>
        </div>

        <div className="welcome-section">
          <div className="welcome-icon">💬</div>
          <h3>Chat Securely</h3>
          <p>Send messages, photos, and voice notes with end-to-end security</p>
        </div>

        <div className="welcome-section">
          <div className="welcome-icon">📱</div>
          <h3>Stay Connected</h3>
          <p>Get notified when friends are online and available to chat</p>
        </div>
      </div>

      <div className="welcome-actions">
        <button
          className="welcome-primary-btn"
          onClick={onSwitchToSearch}
        >
          Find Friends to Chat With
        </button>
        <p className="welcome-tip">
          💡 Tip: Use the search tab above to find friends by username
        </p>
      </div>
    </div>
  );
}

export default WelcomeOnboarding;