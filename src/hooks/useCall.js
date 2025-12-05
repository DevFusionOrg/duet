import { useState, useEffect, useRef } from "react";
import WebRTCService from '../services/webrtc';
import CallService from '../services/callService';
import { notificationService } from "../services/notificationService";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase/firebase";
import { getUserProfile } from "../firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";

export function useCall(user, friend, chatId) {
    const [callState, setCallState] = useState('idle');
    const [isInCall, setIsInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [callStartTime, setCallStartTime] = useState(null);
    const [isBlocked, setIsBlocked] = useState(false);
    
    const callTimeoutRef = useRef(null);
    const ringtoneAudioRef = useRef(null);
    const incomingCallRef = useRef(null);
    const callIdRef = useRef(null);
    const callStateRef = useRef('idle');
    const activeCallListenerRef = useRef(null);
    const callAcceptanceListenerRef = useRef(null);
    const callEndListenerRef = useRef(null);

    useEffect(() => {
        if (!user?.uid || !friend?.uid) return;
        const userRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            const blockedList = userData.blockedUsers || [];
            const isUserBlocked = blockedList.includes(friend?.uid);
            setIsBlocked(isUserBlocked);
        }
        }); 
        return () => {
        if (unsubscribe) unsubscribe();
        };
    }, [user?.uid, friend?.uid]);

    useEffect(() => {
        if (!user?.uid || !friend?.uid) return;
        if (activeCallListenerRef.current) {
        activeCallListenerRef.current();
        activeCallListenerRef.current = null;
        }
        const unsubscribe = CallService.listenForIncomingCalls(user.uid, (calls) => {      
        const relevantCalls = calls.filter(call => {
            const isFromCurrentFriend = call.callerId === friend.uid;
            const isForCurrentUser = call.receiverId === user.uid;
            const isActive = call.status === 'ringing';
            return isFromCurrentFriend && isForCurrentUser && isActive;
        });
        if (relevantCalls.length > 0 && !incomingCall && callStateRef.current === 'idle') {
            const newIncomingCall = relevantCalls[0];
            console.log('Setting incoming call from current friend:', newIncomingCall);
            if (newIncomingCall.receiverId !== user.uid) {
            console.error('Wrong user! This call is for:', newIncomingCall.receiverId, 'but we are:', user.uid);
            return;
            }
            setIncomingCall(newIncomingCall);
            incomingCallRef.current = newIncomingCall;
            callIdRef.current = newIncomingCall.callId;
            callStateRef.current = 'ringing';
            playRingtone();
            if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            }
            callTimeoutRef.current = setTimeout(() => {
            console.log('Auto-declining call after 60 seconds:', newIncomingCall.callId);
            handleAutoDeclineCall(newIncomingCall.callId);
            }, 60000);
        }
        calls.filter(call => call.callerId !== friend.uid && call.receiverId === user.uid)
            .forEach(staleCall => {
            console.log('Cleaning up stale call not from current friend:', staleCall.callId);
            if (staleCall.status === 'ringing') {
                CallService.declineCall(staleCall.callId, user.uid);
            }
            });
        });
        activeCallListenerRef.current = unsubscribe;

        return () => {
        if (unsubscribe) {
            unsubscribe();
            activeCallListenerRef.current = null;
        }
        };
    }, [user?.uid, friend?.uid, incomingCall]);

    useEffect(() => {
        let interval;
        if (isInCall && callState === 'active' && callStartTime) {
        interval = setInterval(() => {
            const duration = Math.floor((Date.now() - callStartTime) / 1000);
            setCallDuration(duration);
        }, 1000);
        }
        return () => {
        if (interval) clearInterval(interval);
        };
    }, [isInCall, callState, callStartTime]);

    useEffect(() => {
    return () => {
        if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
        }
        if (callAcceptanceListenerRef.current) {
        callAcceptanceListenerRef.current();
        callAcceptanceListenerRef.current = null;
        }
        if (callEndListenerRef.current) {
        callEndListenerRef.current();
        callEndListenerRef.current = null;
        }
        
        stopRingtone();
        if (callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
        console.log('Ending call on unmount');
        handleEndCall();
        }
        if (activeCallListenerRef.current) {
        activeCallListenerRef.current();
        activeCallListenerRef.current = null;
        }
        WebRTCService.endCall();
    };
    }, []);

    useEffect(() => {
        if (!callIdRef.current) return;

        // Listen for call status changes (including remote ending)
        const callRef = ref(database, `activeCalls/${callIdRef.current}`);
        
        if (callEndListenerRef.current) {
            callEndListenerRef.current();
        }

        const unsubscribe = onValue(callRef, (snapshot) => {
            const callData = snapshot.val();
            
            if (!callData) {
            // Call was deleted/ended remotely
            if (callStateRef.current === 'active' || callStateRef.current === 'connecting') {
                console.log('Call ended remotely by other user');
                handleEndCall();
            }
            return;
            }

            // Check if call was ended by other user
            if (callData.status === 'ended' || callData.status === 'missed') {
            if (callStateRef.current === 'active' || callStateRef.current === 'connecting') {
                console.log('Call ended by other user with status:', callData.status);
                
                // Show notification
                notificationService.showNotification('Call Ended', {
                body: `Call ended by ${friend?.displayName || 'other user'}`,
                icon: friend?.photoURL || '/default-avatar.png'
                });
                
                // End the call locally
                handleEndCall();
            }
            }
        });

        callEndListenerRef.current = unsubscribe;

        return () => {
            if (callEndListenerRef.current) {
            callEndListenerRef.current();
            callEndListenerRef.current = null;
            }
        };
    }, [callIdRef.current, friend]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log('Tab went to background');
                
                if (ringtoneAudioRef.current) {
                    ringtoneAudioRef.current.pause();
                }
            } else {
                console.log('Tab came to foreground');
                if (ringtoneAudioRef.current && 
                    callStateRef.current === 'ringing' && 
                    incomingCallRef.current) {
                    ringtoneAudioRef.current.play().catch(console.warn);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const playRingtone = () => {
        try {
        stopRingtone();
        ringtoneAudioRef.current = new Audio('/ringtone.mp3');
        ringtoneAudioRef.current.loop = true;
        ringtoneAudioRef.current.volume = 0.7;
        const playPromise = ringtoneAudioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
            console.warn('Ringtone play failed:', error);
            });
        }
        } catch (error) {
        console.error('Error playing ringtone:', error);
        }
    };

    const stopRingtone = () => {
        if (ringtoneAudioRef.current) {
        try {
            ringtoneAudioRef.current.pause();
            ringtoneAudioRef.current.currentTime = 0;
            ringtoneAudioRef.current = null;
        } catch (error) {
            console.error('Error stopping ringtone:', error);
        }
        }
    };

    const cleanupIncomingCall = () => {
        setIncomingCall(null);
        incomingCallRef.current = null;
        callIdRef.current = null;
        callStateRef.current = 'idle';
        stopRingtone();
        if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
        }
    };

    const checkMicrophonePermissions = async () => {
        try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
        } catch (error) {
        console.error('Microphone permission denied:', error);
        alert('Please allow microphone access to make calls');
        return false;
        }
    };

    const listenForWebRTCProgress = (callId) => {
        console.log('👂 Setting up WebRTC progress listener for:', callId);
        // Listen for ICE candidates
        const signalsRef = ref(database, `callSignals/${callId}`);
        const unsubscribe = onValue(signalsRef, (snapshot) => {
        const signals = snapshot.val();
        if (signals) {
            const signalCount = Object.keys(signals).length;
            console.log(`📡 WebRTC signals exchanged: ${signalCount}`);

            // Check if we have both offer and answer
            const hasOffer = Object.values(signals).some(s => s.type === 'offer');
            const hasAnswer = Object.values(signals).some(s => s.type === 'answer');
            const hasCandidates = Object.values(signals).some(s => s.type === 'candidate');
        
            if (hasOffer && hasAnswer && hasCandidates) {
            console.log('✅ WebRTC negotiation complete - should be connecting soon');
            }
        }
        });
        return unsubscribe;
    };

    const listenForSignaling = (callId) => {
        console.log('👂 Setting up signaling listener for call:', callId);
        // Listen for WebRTC signals
        WebRTCService.setOnDisconnect(() => {
        console.log('⚠️ WebRTC disconnected, attempting reconnect...');
        // Attempt to reconnect
        setTimeout(() => {
            if (callStateRef.current === 'connecting' || callStateRef.current === 'active') {
            console.log('Attempting to restart ICE...');
            WebRTCService.restartIce();
            }
        }, 2000);
        });
    };

    const listenForCallAcceptance = (callId) => {
    console.log('Listening for call acceptance:', callId);
    const callRef = ref(database, `activeCalls/${callId}`);
    
    // Clean previous listener if any
    if (callAcceptanceListenerRef.current) {
        callAcceptanceListenerRef.current();
        callAcceptanceListenerRef.current = null;
    }
    
    const unsubscribe = onValue(callRef, (snapshot) => {
        const callData = snapshot.val();
        if (!callData) {
        console.log('Call data removed - call ended');
        if (callStateRef.current === 'active' || callStateRef.current === 'connecting') {
            handleEndCall();
        }
        return;
        }
        
        console.log('Call status update:', callData.status);

        if (callData.status === 'accepted') {
        setCallState('connecting');
        callStateRef.current = 'connecting';
        console.log('Call accepted by receiver');

        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }
        
        } else if (callData.status === 'declined') {
        console.log('Call was declined by receiver');
        handleCallDeclined();

        } else if (callData.status === 'ended' || callData.status === 'missed') {
        console.log('Call ended or missed remotely');
        
        // Only handle if we're still in call
        if (callStateRef.current === 'active' || callStateRef.current === 'connecting' || callStateRef.current === 'ringing') {
            if (callData.status === 'ended') {
            notificationService.showNotification('Call Ended', {
                body: `${friend?.displayName || 'Other user'} ended the call`,
                icon: friend?.photoURL || '/default-avatar.png'
            });
            }
            
            setTimeout(() => {
            handleEndCall();
            }, 1000);
        }
        }
    });
    
    callAcceptanceListenerRef.current = unsubscribe;
    };

    const handleCallDeclined = () => {
        setCallState('ended');
        setIsInCall(false);
        callStateRef.current = 'ended';
        alert('Call declined');
        WebRTCService.endCall();
        // 🔹 clear timeout + listener
        if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
        }
        if (callAcceptanceListenerRef.current) {
        callAcceptanceListenerRef.current();
        callAcceptanceListenerRef.current = null;
        }
        callIdRef.current = null;
    };

    // ALL handler functions from original
    const handleAutoDeclineCall = async (callId) => {
        if (!callId || !user) {
        console.log('No call ID or user for auto decline');
        return;
        }
        try {
        console.log('Auto declining call:', callId);
        await CallService.endCall(callId, user.uid, 0, 'missed');
        if (incomingCallRef.current && chatId) {
            CallService.sendCallNotification(chatId, user.uid, incomingCallRef.current.callerId, 'missed');
        }
        if (incomingCallRef.current) {
            notificationService.showNotification('Missed Call', {
            body: `Missed call from ${incomingCallRef.current.callerName}`,
            icon: friend?.photoURL || '/default-avatar.png'
            });
        } 
        } catch (error) {
        console.error('Error auto declining call:', error);
        } finally {
        cleanupIncomingCall();
        }
    };

    const handleCallTimeout = async (callId) => {
        if (!callId || !user) return;
        // 🔹 Only treat as missed if still ringing
        if (callStateRef.current !== 'ringing') {
        console.log('Call timeout fired but call state is', callStateRef.current, '- ignoring');
        return;
        }

        try {
        await CallService.endCall(callId, user.uid, 0, 'missed');
        if (chatId && friend) {
            CallService.sendCallNotification(chatId, user.uid, friend.uid, 'missed');
        }
        notificationService.showNotification('Call Ended', {
            body: 'Call timed out after 1 minute',
            icon: friend?.photoURL || '/default-avatar.png'
        });
        } catch (error) {
        console.error('Error handling call timeout:', error);
        } finally {
        setCallState('ended');
        setIsInCall(false);
        callStateRef.current = 'ended';
        WebRTCService.endCall();
        callIdRef.current = null;
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }
        if (callAcceptanceListenerRef.current) {
            callAcceptanceListenerRef.current();
            callAcceptanceListenerRef.current = null;
        }
        }
    };

    const initiateAudioCall = async () => {
        if (!user || !friend || !chatId) {
        console.error('Cannot initiate call: Missing user, friend, or chatId');
        return;
        }
        const hasPermission = await checkMicrophonePermissions();
        if (!hasPermission) return;

        if (isBlocked) {
        alert("You cannot call a blocked user");
        return;
        }
        try {
        const otherUserProfile = await getUserProfile(friend.uid);
        if (otherUserProfile?.blockedUsers?.includes(user.uid)) {
            alert("You cannot call this user. You have been blocked.");
            return;
        }
        } catch (error) {
        console.error("Error checking if blocked by user:", error);
        }
        if (callStateRef.current !== 'idle') {
        alert("You are already in a call");
        return;
        }
        try {
        console.log('Initiating audio call to:', friend.displayName);
        setCallState('ringing');
        setIsInCall(true);
        callStateRef.current = 'ringing';
        const callData = await CallService.createCall(
            user.uid,
            user.displayName,
            friend.uid,
            friend.displayName
        );
        callIdRef.current = callData.callId;
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
        }
        callTimeoutRef.current = setTimeout(() => {
            handleCallTimeout(callData.callId);
        }, 60000);
        const stream = await WebRTCService.initializeCall(
            callData.callId,
            true,
            user.uid,
            friend.uid
        );
        WebRTCService.setOnRemoteStream((remoteStream) => {
            console.log('Remote stream received');
            const audioElement = document.querySelector('.remote-audio');
            if (audioElement) {
            audioElement.srcObject = remoteStream;
            audioElement.play().catch(e => console.log('Remote audio play failed:', e));
            }
        });
        WebRTCService.setOnConnect(() => {
            console.log('WebRTC : ✅ Call connected');
            setCallState('active');
            setCallStartTime(Date.now());
            callStateRef.current = 'active';
            if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
            }
            CallService.sendCallNotification(chatId, user.uid, friend.uid, 'started');
        });
        WebRTCService.setOnError((error) => {
            console.error('WebRTC error:', error);
            handleCallError(error);
        });
        WebRTCService.setOnClose(() => {
        console.log('WebRTC connection closed - ending call');
        if (callStateRef.current !== 'ending' && callStateRef.current !== 'ended') {
            handleEndCall();
        }
        });
        WebRTCService.setOnDisconnect(() => {
            console.log('WebRTC disconnected, attempting to reconnect...');
            });
        listenForSignaling(callData.callId);
        listenForCallAcceptance(callData.callId);
        listenForWebRTCProgress(callData.callId);
        } catch (error) {
        console.error('Error initiating call:', error);
        handleCallError(error);
        }
    };

    const handleAcceptCall = async () => {
        if (!incomingCall) {
        console.log('No incoming call to accept');
        return;
        }
        if (incomingCall.receiverId !== user.uid) {
        console.error('Wrong user trying to accept call!');
        alert('This call is not for you');
        cleanupIncomingCall();
        return;
        }
        try {
        stopRingtone();
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }
        setCallState('connecting');
        callStateRef.current = 'connecting';
        await CallService.acceptCall(incomingCall.callId, user.uid);
        callIdRef.current = incomingCall.callId;
        const stream = await WebRTCService.initializeCall(
            incomingCall.callId,
            false,
            user.uid,
            incomingCall.callerId
        );
        WebRTCService.setOnRemoteStream((remoteStream) => {
            console.log('Remote stream received (as receiver)');
            const audioElement = document.querySelector('.remote-audio');
            if (audioElement) {
            audioElement.srcObject = remoteStream;
            audioElement.play().catch(e => console.log('Remote audio play failed:', e));
            }
        });
        WebRTCService.setOnConnect(() => {
            console.log('Call connected as receiver');
            setCallState('active');
            setCallStartTime(Date.now());
            callStateRef.current = 'active';
            if (chatId) {
            CallService.sendCallNotification(chatId, user.uid, incomingCall.callerId, 'started');
            }
        });
        WebRTCService.setOnError((error) => {
            console.error('WebRTC error (receiver):', error);
            handleCallError(error);
        });
        WebRTCService.setOnClose(() => {
        console.log('WebRTC connection closed - ending call');
        if (callStateRef.current !== 'ending' && callStateRef.current !== 'ended') {
            handleEndCall();
        }
        });
        
        listenForSignaling(incomingCall.callId);
        listenForWebRTCProgress(incomingCall.callId);
        setIncomingCall(null);
        incomingCallRef.current = null;
        setIsInCall(true);
        console.log('Call accepted successfully');
        } catch (error) {
        console.error('Error accepting call:', error);
        handleCallError(error);
        }
    };

    const handleDeclineCall = async () => {
        if (!incomingCall) {
        console.log('No incoming call to decline');
        return;
        }
        console.log('Declining call from:', incomingCall.callerName);
        try {
        stopRingtone();
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }
        await CallService.declineCall(incomingCall.callId, user.uid);
        if (chatId) {
            CallService.sendCallNotification(chatId, user.uid, incomingCall.callerId, 'missed');
        }
        notificationService.showNotification('Call Declined', {
            body: `Declined call from ${incomingCall.callerName}`,
            icon: friend?.photoURL || '/default-avatar.png'
        });
        } catch (error) {
        console.error('Error declining call:', error);
        } finally {
        cleanupIncomingCall();
        }
    };

    const handleCallError = (error) => {
        console.error('Call error:', error);
        setCallState('ended');
        setIsInCall(false);
        callStateRef.current = 'ended';
        
        let errorMessage = 'Call failed. Please try again.';
        if (error.message.includes('permission') || error.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
        } else if (error.message.includes('NotFoundError') || error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please check your audio device.';
        }
        
        alert(errorMessage);
        handleEndCall();
    };

    const handleEndCall = async () => {
    console.log('handleEndCall called, current state:', callStateRef.current);
    
    if (callStateRef.current === 'ended' || callStateRef.current === 'idle' || callStateRef.current === 'ending') {
        console.log('Call already ended, skipping');
        return;
    }
    
    callStateRef.current = 'ending';
    
    try {
        const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
        
        stopRingtone();
        
        if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
        }
        
        if (callAcceptanceListenerRef.current) {
        callAcceptanceListenerRef.current();
        callAcceptanceListenerRef.current = null;
        }
        
        if (callEndListenerRef.current) {
        callEndListenerRef.current();
        callEndListenerRef.current = null;
        }
        
        WebRTCService.endCall();
        
        const callIdToEnd = callIdRef.current || incomingCallRef.current?.callId;
        
        console.log('Ending call with ID:', callIdToEnd, 'duration:', duration);

        if (callIdToEnd && user && callStateRef.current === 'ending') {
        await CallService.endCall(callIdToEnd, user.uid, duration, 'ended');
        }

        if (callState === 'active' && chatId && friend) {
        CallService.sendCallNotification(chatId, user.uid, friend.uid, 'ended', duration);
        }

        console.log('Call ended successfully', {
        duration,
        with: friend?.displayName,
        callId: callIdToEnd
        });

    } catch (error) {
        console.error('Error ending call:', error);
    } finally {
        setCallState('idle');
        setIsInCall(false);
        setIncomingCall(null);
        incomingCallRef.current = null;
        callIdRef.current = null;
        setCallDuration(0);
        setCallStartTime(null);
        callStateRef.current = 'idle';
    }
    };

    const handleToggleMute = () => {
        return WebRTCService.toggleMute();
    };

    const handleToggleSpeaker = async () => {
        try {
            const audioElement = document.querySelector('.remote-audio');
            if (!audioElement || !audioElement.srcObject) return false;
            
            const audioTrack = audioElement.srcObject.getAudioTracks()[0];
            if (!audioTrack) return false;
            
            if (audioElement.setSinkId) {
                const currentSink = await audioElement.sinkId;
                
                if (currentSink === '') {
                    await audioElement.setSinkId('speaker');
                    return true;
                } else {
                    await audioElement.setSinkId('');
                    return false;
                }
            } else {
                audioElement.muted = !audioElement.muted;
                return !audioElement.muted;
            }
        } catch (error) {
            console.error('Error toggling speaker:', error);
            return false;
        }
    };

    return {
        callState,
        isInCall,
        incomingCall,
        callDuration,
        initiateAudioCall,
        handleAcceptCall,
        handleDeclineCall,
        handleEndCall,
        cleanupIncomingCall,
        handleToggleMute,
        handleToggleSpeaker,
        handleCallError,
        handleCallTimeout,
        handleCallDeclined,
        handleAutoDeclineCall
    };
}