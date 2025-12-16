import { useState, useEffect, useRef, useCallback } from 'react';
import WebRTCService from '../services/webrtc';
import callService from '../services/callService';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/firebase';

export function useVideoCall(user, friend, chatId) {
  // State
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [callState, setCallState] = useState('idle');
  const [incomingVideoCall, setIncomingVideoCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  // Refs
  const callIdRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef('idle');
  const callAcceptListenerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const hasSetupCallbacksRef = useRef(false);

  // Simple permission check - NO MODAL
  const checkPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      
      if (error.name === 'NotAllowedError') {
        alert('Camera and microphone access is required for video calls. Please allow permissions in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera or microphone found on your device.');
      } else {
        alert('Cannot access camera/microphone. Please check your device permissions.');
      }
      
      return false;
    }
  };

  // Start video call - FIXED
  const startVideoCall = useCallback(async () => {
    console.log('🎬 Starting video call to:', friend?.displayName);

    if (callStateRef.current !== 'idle') {
      console.log('Already in a call');
      return;
    }

    const hasPermissions = await checkPermissions();
    if (!hasPermissions) {
      callStateRef.current = 'idle';
      return;
    }

    try {
      callStateRef.current = 'initiating';
      setCallState('initiating');
      
      const callData = await callService.createVideoCall(
        user.uid,
        user.displayName || user.email,
        friend.uid,
        friend.displayName || friend.email
      );

      callIdRef.current = callData.callId;
      console.log('📞 Video call created:', callData.callId);
      
      setupWebRTCCallbacks();
      playRingtone('outgoing');
      
      // Setup acceptance listener
      callAcceptListenerRef.current = listenForCallAcceptance(callData.callId);
      
      // Set timeout
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'ringing') {
          console.log('⏰ Call timeout - no answer');
          handleCallTimeout(callData.callId);
        }
      }, 60000);

      callStateRef.current = 'ringing';
      setCallState('ringing');
      
    } catch (error) {
      console.error('❌ Error starting video call:', error);
      alert('Failed to start video call. Please try again.');
      cleanupCallState();
    }
  }, [user, friend, chatId]);

  // Listen for call acceptance - FIXED (doesn't end on ringing)
  const listenForCallAcceptance = useCallback((callId) => {
    console.log('🎯 Listening for acceptance of call:', callId);
    
    const callRef = ref(database, `activeCalls/${callId}`);
    
    return onValue(callRef, async (snapshot) => {
      const callData = snapshot.val();
      if (!callData) return;
      
      console.log('📞 Call status update:', callData.status);
      
      if (callData.status === 'accepted') {
        console.log('✅ Call accepted!');
        
        // Clear timeout
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        
        stopRingtone();
        callStateRef.current = 'connecting';
        setCallState('connecting');
        
        try {
          const stream = await WebRTCService.initializeVideoCall(
            callId,
            true,
            user.uid,
            friend.uid,
            { facingMode: 'user' }
          );
          
          setLocalStream(stream);
          console.log('✅ WebRTC initialized as caller');
          
        } catch (error) {
          console.error('❌ WebRTC init error:', error);
          endVideoCall();
        }
        
      } else if (callData.status === 'declined') {
        console.log('📞 Call declined');
        handleCallDeclined(callId);
        
      } else if (callData.status === 'missed') {
        console.log('📞 Call missed');
        handleCallMissed(callId);
        
      } else if (callData.status === 'ended') {
        console.log('📞 Call ended by other side');
        endVideoCall();
      }
      // NOTE: We don't handle 'ringing' status - that's the initial state
    });
  }, [user, friend]);

  // Accept incoming video call - FIXED
  const acceptVideoCall = useCallback(async (callData) => {
    if (!callData || !user) return;
    
    console.log('📞 Accepting video call:', callData.callId);
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (error) {
      alert('Camera/microphone permission required. Please allow access.');
      return;
    }
    
    try {
      callStateRef.current = 'connecting';
      setCallState('connecting');
      
      await callService.acceptCall(callData.callId, user.uid);
      callIdRef.current = callData.callId;
      stopRingtone();
      
      setupWebRTCCallbacks();
      
      const stream = await WebRTCService.initializeVideoCall(
        callData.callId,
        false,
        user.uid,
        callData.callerId,
        { facingMode: 'user' }
      );
      
      setLocalStream(stream);
      setIsVideoCallActive(true);
      setIncomingVideoCall(null);
      
      console.log('✅ Call accepted successfully');
      
    } catch (error) {
      console.error('❌ Error accepting video call:', error);
      alert('Failed to accept call. Please try again.');
      cleanupCallState();
    }
  }, [user]);

  // Setup WebRTC callbacks - FIXED (setup only once)
  const setupWebRTCCallbacks = useCallback(() => {
    if (hasSetupCallbacksRef.current) {
      console.log('🔧 WebRTC callbacks already setup');
      return;
    }
    
    console.log('🔧 Setting up WebRTC callbacks');
    hasSetupCallbacksRef.current = true;
    
    WebRTCService.setOnRemoteStream((remoteStream) => {
      console.log('📹 Remote video stream received');
      setRemoteStream(remoteStream);
    });

    WebRTCService.setOnConnect(() => {
      console.log('✅ Video call connected!');
      callStateRef.current = 'active';
      setCallState('active');
      setCallStartTime(Date.now());
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      if (callAcceptListenerRef.current) {
        callAcceptListenerRef.current();
        callAcceptListenerRef.current = null;
      }
      
      if (chatId) {
        callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'started');
      }
      
      setIsVideoCallActive(true);
    });

    WebRTCService.setOnError((error) => {
      console.error('❌ WebRTC error:', error);
      alert('Video call connection failed. Please try again.');
      endVideoCall();
    });

    WebRTCService.setOnClose(() => {
      console.log('📞 WebRTC connection closed');
      endVideoCall();
    });

    WebRTCService.setOnDisconnect(() => {
      console.log('🔌 WebRTC disconnected');
      setConnectionQuality('poor');
    });
  }, [user, friend, chatId]);

  // Ringtone management
  const playRingtone = useCallback((type = 'incoming') => {
    stopRingtone();
    
    const ringtoneUrl = type === 'incoming' 
      ? '/audio/incoming-call.mp3' 
      : '/audio/outgoing-call.mp3';
    
    try {
      const audio = new Audio(ringtoneUrl);
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(e => console.log('Ringtone play failed:', e));
      ringtoneRef.current = audio;
    } catch (error) {
      console.warn('Could not play ringtone:', error);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  }, []);

  // Handle call timeout
  const handleCallTimeout = useCallback(async (callId) => {
    if (!callId || !user) return;
    
    try {
      console.log('⏰ Call timeout after 60 seconds');
      await callService.endCall(callId, user.uid, 0, 'missed');
      if (chatId && friend) {
        callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'missed');
      }
    } catch (error) {
      console.error('Error handling call timeout:', error);
    } finally {
      endVideoCall();
    }
  }, [user, friend, chatId]);

  // Handle declined call
  const handleCallDeclined = useCallback((callId) => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    stopRingtone();
    cleanupCallState();
  }, []);

  // Handle missed call
  const handleCallMissed = useCallback((callId) => {
    stopRingtone();
    cleanupCallState();
  }, []);

  // Decline video call
  const declineVideoCall = useCallback(async (callId) => {
    if (!callId || !user) return;
    
    try {
      console.log('❌ Declining video call:', callId);
      await callService.declineCall(callId, user.uid);
      if (chatId && incomingVideoCall) {
        callService.sendVideoCallNotification(chatId, user.uid, incomingVideoCall.callerId, 'missed');
      }
    } catch (error) {
      console.error('Error declining video call:', error);
    } finally {
      setIncomingVideoCall(null);
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
  }, [user, chatId, incomingVideoCall]);

  // End video call - FIXED (prevent multiple calls)
  const endVideoCall = useCallback(async () => {
    if (callStateRef.current === 'ended' || callStateRef.current === 'idle') {
      console.log('⚠️ Call already ended or idle, skipping');
      return;
    }

    console.log('📞 Ending video call... Current state:', callStateRef.current);
    callStateRef.current = 'ending';
    
    stopRingtone();
    
    if (callAcceptListenerRef.current) {
      console.log('Removing acceptance listener');
      callAcceptListenerRef.current();
      callAcceptListenerRef.current = null;
    }
    
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    if (localStream) {
      console.log('Stopping local stream tracks');
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setRemoteStream(null);
    
    try {
      WebRTCService.endCall();
    } catch (error) {
      console.warn('Error ending WebRTC call:', error);
    }
    
    const callIdToEnd = callIdRef.current;
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    
    if (callIdToEnd && user) {
      try {
        await callService.endCall(callIdToEnd, user.uid, duration, 'ended');
      } catch (error) {
        console.warn('Error ending call in Firebase:', error);
      }
    }
    
    if (chatId && friend && callState === 'active') {
      callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'ended', duration);
    }
    
    cleanupCallState();
    console.log('✅ Video call ended');
  }, [localStream, user, friend, chatId, callState, callStartTime, stopRingtone]);

  // Cleanup call state (without ending WebRTC)
  const cleanupCallState = useCallback(() => {
    setIsVideoCallActive(false);
    setCallState('idle');
    setIncomingVideoCall(null);
    setCallDuration(0);
    setCallStartTime(null);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setIsSpeaker(false);
    setConnectionQuality('good');
    callIdRef.current = null;
    callStateRef.current = 'idle';
    hasSetupCallbacksRef.current = false;
  }, []);

  // Listen for incoming video calls
  useEffect(() => {
    if (!user?.uid) return;

    console.log('👂 Listening for incoming calls for:', user.uid);

    const unsubscribe = callService.listenForIncomingCalls(user.uid, (calls) => {
      const videoCalls = calls.filter(call => 
        call.type === 'video' && 
        call.status === 'ringing' && 
        call.receiverId === user.uid
      );

      if (videoCalls.length > 0 && callStateRef.current === 'idle') {
        const videoCall = videoCalls[0];
        console.log('📞 Incoming video call from:', videoCall.callerName);
        setIncomingVideoCall(videoCall);
        
        playRingtone('incoming');
        
        callTimeoutRef.current = setTimeout(() => {
          if (callStateRef.current === 'idle' && incomingVideoCall) {
            console.log('⏰ Auto-declining unanswered call');
            declineVideoCall(videoCall.callId);
          }
        }, 60000);
      }
    });

    return () => {
      unsubscribe();
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, [user?.uid, incomingVideoCall, playRingtone, stopRingtone, declineVideoCall]);

  // Handle call duration
  useEffect(() => {
    let interval;
    if (callState === 'active' && callStartTime) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(duration);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, callStartTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
        endVideoCall();
      }
      stopRingtone();
    };
  }, [endVideoCall, stopRingtone]);

  return {
    // State
    isVideoCallActive,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    isSpeaker,
    isFrontCamera,
    connectionQuality,
    callState,
    incomingVideoCall,
    callDuration,
    
    // Actions
    startVideoCall,
    acceptVideoCall,
    declineVideoCall: (callId) => declineVideoCall(callId || incomingVideoCall?.callId),
    endVideoCall,
    
    // Media controls
    toggleVideo: useCallback(() => {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          setIsVideoEnabled(videoTrack.enabled);
        }
      }
    }, [localStream]),
    
    toggleAudio: useCallback(() => {
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setIsAudioEnabled(audioTrack.enabled);
        }
      }
    }, [localStream]),
    
    switchCamera: useCallback(async () => {
      if (!localStream) return null;
      try {
        const result = await WebRTCService.switchCamera(isFrontCamera ? 'environment' : 'user');
        setIsFrontCamera(!isFrontCamera);
        return result;
      } catch (error) {
        console.error('Error switching camera:', error);
        return null;
      }
    }, [localStream, isFrontCamera])
  };
}