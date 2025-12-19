import React, { useState, useRef, useEffect } from 'react';
import '../../styles/VoiceRecorder.css';

function VoiceRecorder({ onSend, onCancel, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioElementRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onloadedmetadata = () => {
          setAudioDuration(audio.duration);
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handlePlayPause = () => {
    if (!audioBlob) return;

    if (!audioElementRef.current) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioElementRef.current = new Audio(audioUrl);
      
      audioElementRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }
      };
    }

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
      
      playbackIntervalRef.current = setInterval(() => {
        if (audioElementRef.current) {
          setPlaybackTime(audioElementRef.current.currentTime);
        }
      }, 100);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, recordingTime);
    }
  };

  const handleCancel = () => {
    stopRecording();
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    onCancel();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    
    startRecording();
  }, []);

  return (
    <div className="voice-recorder-container">
      <div className="voice-recorder-content">
        {!audioBlob ? (
          <>
            <div className="recording-indicator">
              <div className={`recording-dot ${isRecording ? 'pulse' : ''}`}></div>
              <span className="recording-text">
                {isRecording ? 'Recording...' : 'Ready'}
              </span>
            </div>
            
            <div className="recording-timer">{formatTime(recordingTime)}</div>
            
            <div className="recording-waveform">
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
            </div>
          </>
        ) : (
          <>
            <button 
              className="voice-play-button"
              onClick={handlePlayPause}
              disabled={disabled}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <div className="voice-playback-info">
              <div className="voice-progress-bar">
                <div 
                  className="voice-progress-fill"
                  style={{ width: `${(playbackTime / audioDuration) * 100}%` }}
                ></div>
              </div>
              <div className="voice-time">
                {formatTime(isPlaying ? playbackTime : audioDuration)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="voice-recorder-actions">
        <button 
          className="voice-cancel-button"
          onClick={handleCancel}
          disabled={disabled}
          title="Cancel"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        {!isRecording && audioBlob && (
          <button 
            className="voice-send-button"
            onClick={handleSend}
            disabled={disabled}
            title="Send voice note"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        )}

        {isRecording && (
          <button 
            className="voice-stop-button"
            onClick={stopRecording}
            disabled={disabled}
            title="Stop recording"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default VoiceRecorder;
