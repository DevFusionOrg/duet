import React from 'react';
import '../../styles/Call.css';

const CallControls = ({ 
  isMuted, 
  isSpeaker, 
  onMuteToggle, 
  onSpeakerToggle, 
  onEndCall,
  showAllControls = true
}) => {
  return (
    <div className="call-controls">
      {/* Only show mute and speaker when call is active */}
      {showAllControls && (
        <>
          <button 
            className={`call-control-button ${isMuted ? 'call-control-active' : ''}`}
            onClick={onMuteToggle}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            <svg class="x14rh7hd x1lliihq x1tzjh5l x1k90msu x2h7rmj x1qfuztq" viewBox="6 6 36 36"><path class="x1labep9 x19991ni x9lcvmn" d="M20 34h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2m4-5.5a5 5 0 0 1-5-5V17a5 5 0 0 1 10 0v6.5a5 5 0 0 1-5 5m0 4a9 9 0 0 1-9-9 1 1 0 0 1 2 0 7 7 0 1 0 14 0 1 1 0 0 1 2 0 9 9 0 0 1-9 9" fill="url(#gradientFill)"></path><defs><linearGradient id="gradientFill" x1="0" x2="0" y1="0" y2="100%"><stop offset="100%" stop-color="var(--always-white)"></stop><stop offset="0%" stop-color="var(--primary-button-background)"></stop></linearGradient></defs></svg>
          </button>
          <button 
            className={`call-control-button ${isSpeaker ? 'call-control-active' : ''}`}
            onClick={onSpeakerToggle}
            aria-label={isSpeaker ? "Switch to earpiece" : "Switch to speaker"}
          >
            <svg viewBox="0 0 36 36" width="32" height="32">
              <path d="M18.425 8.455C19.365 7.49 21 8.155 21 9.5V26.5c0 1.346-1.636 2.01-2.575 1.046l-3.983-4.091A1.5 1.5 0 0 0 13.367 23H10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3.367a1.5 1.5 0 0 0 1.075-.454l3.983-4.091zM24.25 14.008c-.394-.567-.405-1.353.083-1.842.488-.488 1.287-.492 1.707.056A9.459 9.459 0 0 1 28 18c0 2.174-.731 4.177-1.96 5.779-.42.547-1.219.543-1.707.055-.488-.488-.477-1.275-.083-1.842A6.968 6.968 0 0 0 25.5 18c0-1.484-.462-2.86-1.25-3.992z"></path>
            </svg>
          </button>
        </>
      )}

      {/* End Call Button - always visible */}
      <button 
        className="call-control-button call-end-button"
        onClick={onEndCall}
        aria-label="End call"
      >
        <svg viewBox="0 0 36 36" width="32" height="32">
          <path d="M4.865 18.073c-.522 1.043-.396 2.26-.146 3.4a2.12 2.12 0 0 0 1.547 1.602c.403.099.812.175 1.234.175 1.276 0 2.505-.2 3.659-.568.642-.205 1.085-.775 1.206-1.438l.472-2.599a.488.488 0 0 1 .28-.36A11.959 11.959 0 0 1 18 17.25c1.739 0 3.392.37 4.883 1.035.148.066.251.202.28.36l.472 2.599c.12.663.564 1.233 1.206 1.438 1.154.369 2.383.568 3.66.568.421 0 .83-.077 1.233-.175a2.12 2.12 0 0 0 1.547-1.601c.25-1.14.377-2.358-.146-3.401-1.722-3.44-7.06-5.323-13.135-5.323S6.587 14.633 4.865 18.073z"></path>
        </svg>
      </button>
    </div>
  );
};

export default CallControls;