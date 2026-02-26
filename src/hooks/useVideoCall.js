import { useState, useEffect, useRef, useCallback } from 'react';
import WebRTCService from '../services/webrtc';
import callService from '../services/callService';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase/firebase';

export function useVideoCall(user, friend, chatId) {
  const friendId = friend?.uid || friend?.id;
  
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

  const callIdRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef('idle');
  const callAcceptListenerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const hasSetupCallbacksRef = useRef(false);
  const endVideoCallRef = useRef(null);
  const callInitiatorRef = useRef(null);

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

  const startVideoCall = useCallback(async () => {
    console.log('🎬 Starting video call to:', friend?.displayName);

    if (!user?.uid || !friendId || !chatId) {
      alert('Call failed. Please try again.');
      return;
    }

    if (callStateRef.current !== 'idle') {
      console.log('Cleaning up previous call state...');
      cleanupCallState();
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const hasPermissions = await checkPermissions();
    if (!hasPermissions) {
      callStateRef.current = 'idle';
      return;
    }

    try {
      callStateRef.current = 'initiating';
      setCallState('initiating');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
            frameRate: { ideal: 30, max: 60 }
          }
        });
        setLocalStream(stream);
        console.log('Local stream acquired for caller preview');
      } catch (error) {
        console.error('Failed to get media:', error);
        alert('Cannot access camera/microphone. Please check permissions.');
        cleanupCallState();
        return;
      }
      
      const callData = await callService.createVideoCall(
        user.uid,
        user.displayName || user.email,
        friendId,
        friend.displayName || friend.email
      );

      callIdRef.current = callData.callId;
      callInitiatorRef.current = user.uid;
      console.log('Video call created:', callData.callId);

      setupWebRTCCallbacks();

      callAcceptListenerRef.current = listenForCallAcceptance(callData.callId);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friend, chatId]);

  const listenForCallAcceptance = useCallback((callId) => {
    console.log('🎯 Listening for acceptance of call:', callId);
    
    const callRef = ref(database, `activeCalls/${callId}`);
    
    return onValue(callRef, async (snapshot) => {
      const callData = snapshot.val();
      if (!callData) return;
      
      console.log('Call status update:', callData.status);
      
      if (callData.status === 'accepted') {
        console.log('Call accepted!');

        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        
        stopRingtone();
        callStateRef.current = 'connecting';
        setCallState('connecting');
        
        try {
          
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          
          const stream = await WebRTCService.initializeVideoCall(
            callId,
            true,
            user.uid,
            friendId,
            { facingMode: 'user' }
          );
          
          setLocalStream(stream);
          console.log('✅ WebRTC initialized as caller');
          
        } catch (error) {
          console.error('❌ WebRTC init error:', error);
          
          callStateRef.current = 'error';
          setCallState('error');
          alert('Failed to initialize video call. Please try again.');
          
          if (callIdRef.current) {
            try {
              await callService.endCall(callIdRef.current, user.uid, 0, 'failed');
            } catch (e) {
              console.warn('Error ending call:', e);
            }
          }
          cleanupCallState();
        }
        
      } else if (callData.status === 'declined') {
        console.log('Call declined');
        handleCallDeclined(callId);
        
      } else if (callData.status === 'missed') {
        console.log('Call missed');
        handleCallMissed(callId);
        
      } else if (callData.status === 'ended') {
        console.log('Call ended by other side');
        if (callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
          callStateRef.current = 'ended';
          setIsVideoCallActive(false);
        }
      }
      
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friend]);

  const acceptVideoCall = useCallback(async (callData) => {
    if (!callData || !user) return;
    
    console.log('Accepting video call:', callData.callId);

    callInitiatorRef.current = callData.callerId;
    
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

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await WebRTCService.initializeVideoCall(
        callData.callId,
        false,
        user.uid,
        callData.callerId,
        { facingMode: 'user' }
      );
      
      setLocalStream(stream);
      setIncomingVideoCall(null);
      
      console.log('✅ Call accepted successfully - waiting for WebRTC connection');
      
    } catch (error) {
      console.error('❌ Error accepting video call:', error);
      alert('Failed to accept call. Please try again.');
      cleanupCallState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setupWebRTCCallbacks = useCallback(() => {
    if (hasSetupCallbacksRef.current) {
      console.log('🔧 WebRTC callbacks already setup');
      return;
    }
    
    console.log('Setting up WebRTC callbacks');
    hasSetupCallbacksRef.current = true;
    
    WebRTCService.setOnRemoteStream((remoteStream) => {
      console.log('Remote video stream received');
      setRemoteStream(remoteStream);
    });

    WebRTCService.setOnConnect(() => {
      console.log('Video call connected!');
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
      
      setIsVideoCallActive(true);
    });

    WebRTCService.setOnError((error) => {
      console.error('WebRTC error:', error);
      alert('Video call connection failed. Please try again.');
      
      callStateRef.current = 'error';
      setCallState('error');
    });

    WebRTCService.setOnClose(() => {
      console.log('WebRTC connection closed - ending video call');
      
      if (endVideoCallRef.current && callStateRef.current !== 'idle' && callStateRef.current !== 'ended' && callStateRef.current !== 'ending') {
        endVideoCallRef.current();
      }
    });

    WebRTCService.setOnDisconnect(() => {
      console.log('WebRTC disconnected');
      setConnectionQuality('poor');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friend, friendId, chatId]);

  const playRingtone = useCallback((type = 'incoming') => {
    stopRingtone();

    const ringtoneUrl = '/ringtone.mp3';
    
    try {
      const audio = new Audio(ringtoneUrl);
      audio.loop = true;
      audio.volume = type === 'incoming' ? 0.7 : 0.5; 
      audio.play().catch(e => console.log('Ringtone play failed:', e));
      ringtoneRef.current = audio;
    } catch (error) {
      console.warn('Could not play ringtone:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friend, chatId]);

  const handleCallDeclined = useCallback((callId) => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    stopRingtone();
    cleanupCallState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCallMissed = useCallback((callId) => {
    stopRingtone();
    cleanupCallState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatId, incomingVideoCall]);

  const endVideoCall = useCallback(async () => {
    if (callStateRef.current === 'ended' || callStateRef.current === 'idle') {
      console.log('Call already ended or idle, skipping');
      return;
    }

    console.log('Ending video call... Current state:', callStateRef.current);
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
      const callerId = callInitiatorRef.current || user.uid;
      if (user.uid === callerId) {
        callService.sendVideoCallNotification(
          chatId,
          user.uid,
          friend.uid,
          'ended',
          duration,
          { callerId }
        );
      }
    }
    
    cleanupCallState();
    console.log('Video call ended');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, user, friend, chatId, callState, callStartTime, stopRingtone]);

  useEffect(() => {
    endVideoCallRef.current = endVideoCall;
  }, [endVideoCall]);

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
        console.log('Incoming video call from:', videoCall.callerName);
        setIncomingVideoCall(videoCall);
        
        playRingtone('incoming');
        
        callTimeoutRef.current = setTimeout(() => {
          if (callStateRef.current === 'idle' && incomingVideoCall) {
            console.log('Auto-declining unanswered call');
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

  useEffect(() => {
    return () => {
      
      if (callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
        
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current.currentTime = 0;
          ringtoneRef.current = null;
        }

        try {
          WebRTCService.endCall();
        } catch (error) {
          console.warn('Error ending WebRTC on unmount:', error);
        }
      }
    };
  }, []); 

  return {
    
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

    startVideoCall,
    acceptVideoCall,
    declineVideoCall: (callId) => declineVideoCall(callId || incomingVideoCall?.callId),
    endVideoCall,

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
      const muted = WebRTCService.toggleMute();
      
      setIsAudioEnabled(!muted);
      return muted;
    }, []),
    
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