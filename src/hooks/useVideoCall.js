import { useState, useEffect, useRef, useCallback } from 'react';
import WebRTCService from '../services/webrtc';
import callService from '../services/callService';
import videoService from '../services/videoService';
import mediaPermissions from '../services/mediaPermissions';
import { notificationService } from '../services/notifications';
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
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [incomingVideoCall, setIncomingVideoCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  // Refs
  const peerConnectionRef = useRef(null);
  const callIdRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const qualityCheckIntervalRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef('idle');

  // Check permissions before starting video call
  const checkAndRequestPermissions = async () => {
    try {
      // Check existing permissions
      const permissions = await mediaPermissions.checkAllPermissions();
      
      if (!permissions.allGranted) {
        // Request permissions
        const result = await mediaPermissions.requestMediaPermissions();
        
        if (!result.success) {
          setPermissionError(result.error.code || 'NotAllowedError');
          setPermissionsModalOpen(true);
          return false;
        }
        
        setLocalStream(result.stream);
        return true;
      }
      
      // Permissions already granted, get stream
      const result = await videoService.requestMediaAccess();
      if (result.success) {
        setLocalStream(result.stream);
        return true;
      } else {
        setPermissionError(result.code);
        setPermissionsModalOpen(true);
        return false;
      }
    } catch (error) {
      console.error('Permission error:', error);
      setPermissionError(error.name);
      setPermissionsModalOpen(true);
      return false;
    }
  };

  // Start a video call
  const startVideoCall = useCallback(async () => {
    if (!user || !friend || !chatId) {
      console.error('Cannot start video call: Missing user, friend, or chatId');
      return;
    }

    // Check if already in call
    if (callStateRef.current !== 'idle') {
      alert('You are already in a call');
      return;
    }

    // Check permissions
    const hasPermissions = await checkAndRequestPermissions();
    if (!hasPermissions) return;

    try {
      console.log('Starting video call to:', friend.displayName);
      callStateRef.current = 'initiating';
      setCallState('initiating');
      
      // Create video call in Firebase
      const callData = await callService.createVideoCall(
        user.uid,
        user.displayName,
        friend.uid,
        friend.displayName
      );

      callIdRef.current = callData.callId;
      
      // Initialize WebRTC with video
      await WebRTCService.initializeVideoCall(
        callData.callId,
        true,
        user.uid,
        friend.uid,
        { facingMode: 'user' }
      );

      // Setup WebRTC callbacks
      setupWebRTCCallbacks();

      // Listen for call acceptance
      listenForCallAcceptance(callData.callId);

      // Set timeout for call ringing
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'ringing') {
          handleCallTimeout(callData.callId);
        }
      }, 60000); // 1 minute timeout

      setIsVideoCallActive(true);
      callStateRef.current = 'ringing';
      setCallState('ringing');

    } catch (error) {
      console.error('Error starting video call:', error);
      handleVideoCallError(error);
    }
  }, [user, friend, chatId]);

  // Accept incoming video call
  const acceptVideoCall = useCallback(async (callData) => {
    if (!callData || !user) {
      console.error('No call data or user');
      return;
    }

    // Check permissions
    const hasPermissions = await checkAndRequestPermissions();
    if (!hasPermissions) return;

    try {
      console.log('Accepting video call:', callData.callId);
      callStateRef.current = 'connecting';
      setCallState('connecting');
      
      // Accept the call in Firebase
      await callService.acceptCall(callData.callId, user.uid);
      callIdRef.current = callData.callId;

      // Initialize WebRTC as receiver
      await WebRTCService.initializeVideoCall(
        callData.callId,
        false,
        user.uid,
        callData.callerId,
        { facingMode: 'user' }
      );

      // Setup WebRTC callbacks
      setupWebRTCCallbacks();

      setIsVideoCallActive(true);
      setIncomingVideoCall(null);

      // Start monitoring connection quality
      startQualityMonitoring();

    } catch (error) {
      console.error('Error accepting video call:', error);
      handleVideoCallError(error);
    }
  }, [user]);

  // Setup WebRTC callbacks
  const setupWebRTCCallbacks = () => {
    WebRTCService.setOnRemoteStream((remoteStream) => {
      console.log('Remote video stream received');
      setRemoteStream(remoteStream);
      
      // Auto-play remote video
      const videoElement = document.querySelector('.remote-video');
      if (videoElement) {
        videoElement.srcObject = remoteStream;
        videoElement.play().catch(e => console.log('Remote video play error:', e));
      }
    });

    WebRTCService.setOnConnect(() => {
      console.log('✅ Video call connected');
      callStateRef.current = 'active';
      setCallState('active');
      setCallStartTime(Date.now());
      
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      // Start monitoring connection quality
      startQualityMonitoring();
      
      // Send call started notification
      if (chatId) {
        callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'started');
      }
    });

    WebRTCService.setOnError((error) => {
      console.error('WebRTC video error:', error);
      handleVideoCallError(error);
    });

    WebRTCService.setOnClose(() => {
      console.log('WebRTC video connection closed');
      if (callStateRef.current !== 'ending' && callStateRef.current !== 'ended') {
        endVideoCall();
      }
    });

    WebRTCService.setOnDisconnect(() => {
      console.log('WebRTC video disconnected');
      setConnectionQuality('poor');
      setTimeout(() => {
        if (callStateRef.current === 'active') {
          WebRTCService.restartIce();
        }
      }, 2000);
    });
  };

  // Listen for incoming video calls
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = callService.listenForIncomingCalls(user.uid, (calls) => {
      const videoCalls = calls.filter(call => 
        call.type === 'video' && 
        call.status === 'ringing' && 
        call.receiverId === user.uid
      );

      if (videoCalls.length > 0 && !incomingVideoCall && callStateRef.current === 'idle') {
        const videoCall = videoCalls[0];
        setIncomingVideoCall(videoCall);
        
        // Play ringtone
        const ringtone = new Audio('/video-ringtone.mp3');
        ringtone.loop = true;
        ringtone.play().catch(console.warn);
        
        // Auto-decline after 60 seconds
        callTimeoutRef.current = setTimeout(() => {
          if (callStateRef.current === 'idle' && incomingVideoCall) {
            declineVideoCall(videoCall.callId);
          }
        }, 60000);
      }
    });

    return () => {
      unsubscribe();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, [user?.uid, incomingVideoCall]);

  // Handle call duration
  useEffect(() => {
    let interval;
    if (callState === 'active' && callStartTime) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(duration);
        
        // Update quality based on duration
        if (duration % 10 === 0) {
          checkConnectionQuality();
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, callStartTime]);

  // Toggle camera on/off
  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        return videoTrack.enabled;
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
    return false;
  }, [localStream]);

  // Toggle microphone on/off
  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    
    try {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        return audioTrack.enabled;
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
    return false;
  }, [localStream]);

  // Switch between front/back camera
  const switchCamera = useCallback(async () => {
    if (!localStream) return;
    
    try {
      const result = await videoService.switchCamera(localStream, isFrontCamera ? 'environment' : 'user');
      if (result.success) {
        setIsFrontCamera(!isFrontCamera);
        setLocalStream(result.stream);
        return result.facingMode;
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
    return null;
  }, [localStream, isFrontCamera]);

  // Adjust video quality
  const adjustVideoQuality = useCallback(async (quality = 'medium') => {
    if (!localStream) return false;
    
    try {
      const success = await videoService.adjustVideoQuality(localStream, quality);
      if (success) {
        setConnectionQuality(quality === 'low' ? 'poor' : quality === 'medium' ? 'good' : 'excellent');
      }
      return success;
    } catch (error) {
      console.error('Error adjusting quality:', error);
      return false;
    }
  }, [localStream]);

  // Check connection quality
  const checkConnectionQuality = useCallback(async () => {
    if (!peerConnectionRef.current) return;
    
    try {
      const stats = await WebRTCService.getConnectionStats();
      if (stats) {
        // Analyze stats to determine quality
        const videoStats = Object.values(stats).find(s => s.type === 'track' && s.mediaType === 'video');
        
        if (videoStats) {
          const packetsLost = videoStats.packetsLost || 0;
          const packetsTotal = videoStats.packetsSent || 1;
          const packetLoss = (packetsLost / packetsTotal) * 100;
          
          let quality = 'good';
          if (packetLoss < 2) quality = 'excellent';
          else if (packetLoss < 10) quality = 'good';
          else if (packetLoss < 20) quality = 'poor';
          else quality = 'very-poor';
          
          setConnectionQuality(quality);
          
          // Auto-adjust quality if poor
          if (quality === 'poor' || quality === 'very-poor') {
            adjustVideoQuality('low');
          }
        }
      }
    } catch (error) {
      console.error('Error checking connection quality:', error);
    }
  }, [adjustVideoQuality]);

  // Start quality monitoring
  const startQualityMonitoring = () => {
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
    }
    
    qualityCheckIntervalRef.current = setInterval(() => {
      checkConnectionQuality();
    }, 5000); // Check every 5 seconds
  };

  // Listen for call acceptance
  const listenForCallAcceptance = (callId) => {
    const callRef = ref(database, `activeCalls/${callId}`);
    
    const unsubscribe = onValue(callRef, (snapshot) => {
      const callData = snapshot.val();
      if (!callData) return;
      
      if (callData.status === 'accepted') {
        callStateRef.current = 'connecting';
        setCallState('connecting');
        
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
      } else if (callData.status === 'declined' || callData.status === 'ended') {
        endVideoCall();
      }
    });
    
    return unsubscribe;
  };

  // Handle call timeout
  const handleCallTimeout = async (callId) => {
    if (!callId || !user) return;
    
    try {
      await callService.endCall(callId, user.uid, 0, 'missed');
      if (chatId && friend) {
        callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'missed');
      }
      
      notificationService.showNotification('Call Ended', {
        body: 'Video call timed out after 1 minute',
        icon: friend?.photoURL || '/default-avatar.png'
      });
    } catch (error) {
      console.error('Error handling call timeout:', error);
    } finally {
      endVideoCall();
    }
  };

  // Decline video call
  const declineVideoCall = async (callId) => {
    if (!callId || !user) return;
    
    try {
      await callService.declineCall(callId, user.uid);
      if (chatId && incomingVideoCall) {
        callService.sendVideoCallNotification(chatId, user.uid, incomingVideoCall.callerId, 'missed');
      }
    } catch (error) {
      console.error('Error declining video call:', error);
    } finally {
      setIncomingVideoCall(null);
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
  };

  // End video call
  const endVideoCall = useCallback(async () => {
    if (callStateRef.current === 'ended') return;
    
    callStateRef.current = 'ending';
    
    try {
      // Stop all monitoring intervals
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
        qualityCheckIntervalRef.current = null;
      }
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        setLocalStream(null);
      }
      
      // Clear remote stream
      setRemoteStream(null);
      
      // End WebRTC call
      WebRTCService.endCall();
      
      // Update Firebase call status
      const callIdToEnd = callIdRef.current;
      const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
      
      if (callIdToEnd && user) {
        await callService.endCall(callIdToEnd, user.uid, duration, 'ended');
      }
      
      // Send call ended notification
      if (chatId && friend && callState === 'active') {
        callService.sendVideoCallNotification(chatId, user.uid, friend.uid, 'ended', duration);
      }
      
      console.log('Video call ended', { duration, with: friend?.displayName });
      
    } catch (error) {
      console.error('Error ending video call:', error);
    } finally {
      // Reset all state
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
      
      // Clear timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
  }, [localStream, user, friend, chatId, callState, callStartTime]);

  // Handle video call errors
  const handleVideoCallError = useCallback((error) => {
    console.error('Video call error:', error);
    
    let errorMessage = 'Video call failed. Please try again.';
    let shouldShowModal = false;
    
    switch(error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        errorMessage = 'Camera/microphone permission denied.';
        shouldShowModal = true;
        setPermissionError(error.name);
        break;
      case 'NotFoundError':
        errorMessage = 'No camera/microphone found.';
        shouldShowModal = true;
        setPermissionError(error.name);
        break;
      case 'NotReadableError':
        errorMessage = 'Camera/microphone is in use by another app.';
        shouldShowModal = true;
        setPermissionError(error.name);
        break;
      case 'OverconstrainedError':
        errorMessage = 'Camera cannot provide the requested resolution.';
        break;
    }
    
    if (shouldShowModal) {
      setPermissionsModalOpen(true);
    } else {
      alert(errorMessage);
    }
    
    // End the call on error
    endVideoCall();
  }, [endVideoCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endVideoCall();
      
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, [endVideoCall]);

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
    permissionsModalOpen,
    permissionError,
    callState,
    incomingVideoCall,
    callDuration,
    
    // Actions
    startVideoCall,
    acceptVideoCall,
    declineVideoCall: (callId) => declineVideoCall(callId || incomingVideoCall?.callId),
    endVideoCall,
    toggleVideo,
    toggleAudio,
    switchCamera,
    adjustVideoQuality,
    
    // Permission modal
    setPermissionsModalOpen,
    
    // Callbacks for UI
    handlePermissionsAllow: async () => {
      try {
        const result = await mediaPermissions.requestMediaPermissions();
        if (result.success) {
          setLocalStream(result.stream);
          setPermissionsModalOpen(false);
          setPermissionError(null);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error allowing permissions:', error);
        return false;
      }
    },
    
    handlePermissionsCancel: () => {
      setPermissionsModalOpen(false);
      setPermissionError(null);
      endVideoCall();
    }
  };
}