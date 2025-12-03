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
            <svg viewBox="0 0 36 36" width="32" height="32">
              <mask id="mute-mask">
                <svg viewBox="0 0 36 36" fill="currentColor" width="100%" height="100%">
                  <path d="M14 11a4 4 0 0 1 8 0v5.5a4 4 0 0 1-8 0V11z"></path>
                  <path d="M12.5 27.5a1 1 0 0 1 1-1h2.75a.5.5 0 0 0 .5-.5v-.66a.522.522 0 0 0-.425-.505A8.503 8.503 0 0 1 9.5 16.5V16a1 1 0 0 1 1-1h.5a1 1 0 0 1 1 1v.5a6 6 0 0 0 12 0V16a1 1 0 0 1 1-1h.5a1 1 0 0 1 1 1v.5a8.503 8.503 0 0 1-6.825 8.335.522.522 0 0 0-.425.505V26a.5.5 0 0 0 .5.5h2.75a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-.5z"></path>
                </svg>
              </mask>
              <g mask="url(#mute-mask)">
                <rect fill="var(--always-white)" height="100%" width="100%"></rect>
                <rect fill="var(--primary-button-background)" height="100%" width="100%"></rect>
              </g>
            </svg>
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