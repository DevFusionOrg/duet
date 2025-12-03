// UPDATED webrtc.js with comprehensive fixes
import { database } from '../firebase/firebase';
import { ref, set, onValue, remove, off } from 'firebase/database';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingRef = null;
    this.signalingListener = null; // Add listener reference
    this.callId = null;
    this.isInitiator = false;
    this.onRemoteStreamCallback = null;
    this.onConnectCallback = null;
    this.onErrorCallback = null;
    this.onCloseCallback = null;
    
    // Enhanced state tracking
    this.isNegotiating = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.remoteUserId = null;
    this.connectionState = 'disconnected'; // Track connection state
    this.isEnded = false; // Prevent re-entry
    
    // ICE gathering state
    this.isIceGatheringComplete = false;
    
    // Offer/Answer tracking
    this.lastOffer = null;
    this.lastAnswer = null;
  }

  async initializeCall(callId, isInitiator, userId, friendId) {
    // Prevent re-initialization
    if (this.peer && !this.isEnded) {
      console.warn('Call already initialized, cleaning up first');
      await this.endCall();
    }
    
    this.isEnded = false;
    this.callId = callId;
    this.isInitiator = isInitiator;
    this.remoteUserId = isInitiator ? friendId : userId;
    this.connectionState = 'initializing';
    
    // Setup signaling with structured paths
    this.signalingRef = ref(database, `calls/${callId}/signals`);
    
    // Clear any previous signaling data
    try {
      await remove(this.signalingRef);
    } catch (error) {
      console.warn('Could not clear previous signaling data:', error);
    }
    
    try {
      // Get user media with better error handling
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });
      
      // Add track event listener for debugging
      this.localStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('Local track ended:', track.kind);
          this.handleTrackEnded();
        };
      });
      
      return this.localStream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      this.connectionState = 'failed';
      throw error;
    }
  }

  // Enhanced peer connection creation with proper state management
  createPeer(stream) {
    try {
      // Close existing peer if any
      if (this.peer && this.peer.connectionState !== 'closed') {
        this.peer.close();
      }
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      this.peer = new RTCPeerConnection(configuration);
      this.connectionState = 'new';
      
      // Reset negotiation state
      this.isNegotiating = false;
      this.hasRemoteDescription = false;
      this.pendingCandidates = [];
      this.isIceGatheringComplete = false;
      this.lastOffer = null;
      this.lastAnswer = null;

      // Add local stream tracks with error handling
      stream.getTracks().forEach(track => {
        try {
          this.peer.addTrack(track, stream);
        } catch (error) {
          console.error('Error adding track:', error);
        }
      });

      // Handle remote stream
      this.peer.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          
          // Add track ended listeners
          this.remoteStream.getTracks().forEach(track => {
            track.onended = () => {
              console.log('Remote track ended:', track.kind);
              this.handleTrackEnded();
            };
          });
          
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        }
      };

      // Handle ICE candidates with better validation and debouncing
      let iceCandidateQueue = [];
      let iceCandidateTimer = null;
      
      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate;
          
          // Validate candidate before sending
          if (candidate.candidate && candidate.candidate.length > 0) {
            // Queue candidates to avoid flooding
            iceCandidateQueue.push({
              type: 'candidate',
              candidate: {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid || '0', // Default values
                sdpMLineIndex: candidate.sdpMLineIndex || 0,
                usernameFragment: candidate.usernameFragment || ''
              },
              timestamp: Date.now()
            });
            
            // Debounce sending candidates (send batch every 100ms)
            if (!iceCandidateTimer) {
              iceCandidateTimer = setTimeout(() => {
                if (iceCandidateQueue.length > 0) {
                  this.sendSignals(iceCandidateQueue);
                  iceCandidateQueue = [];
                }
                iceCandidateTimer = null;
              }, 100);
            }
          }
        } else {
          // ICE gathering complete
          console.log('ICE gathering complete');
          this.isIceGatheringComplete = true;
        }
      };

      // Handle negotiation needed with queueing
      this.peer.onnegotiationneeded = async () => {
        if (this.isNegotiating) {
          console.log('Already negotiating, skipping');
          return;
        }
        
        if (!this.isInitiator) {
          console.log('Not initiator, skipping negotiation');
          return;
        }
        
        if (this.connectionState === 'closed' || this.isEnded) {
          console.log('Connection closed, skipping negotiation');
          return;
        }
        
        this.isNegotiating = true;
        try {
          console.log('Starting negotiation...');
          await this.createOffer();
        } catch (error) {
          console.error('Negotiation error:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
        } finally {
          // Allow renegotiation after delay
          setTimeout(() => {
            this.isNegotiating = false;
          }, 1000);
        }
      };

      // Handle connection states
      this.peer.onconnectionstatechange = () => {
        const state = this.peer.connectionState;
        console.log('Connection state changed:', state);
        this.connectionState = state;
        
        switch (state) {
          case 'connected':
            console.log('WebRTC connection established');
            if (this.onConnectCallback) {
              this.onConnectCallback();
            }
            break;
          case 'disconnected':
            console.log('WebRTC disconnected, attempting to reconnect...');
            setTimeout(() => {
              if (this.peer && this.peer.connectionState === 'disconnected') {
                this.restartIce();
              }
            }, 2000);
            break;
          case 'failed':
            console.error('WebRTC connection failed');
            if (this.onErrorCallback) {
              this.onErrorCallback(new Error('Connection failed'));
            }
            break;
          case 'closed':
            console.log('WebRTC connection closed');
            if (this.onCloseCallback && !this.isEnded) {
              this.onCloseCallback();
            }
            break;
        }
      };

      // Handle ICE connection state
      this.peer.oniceconnectionstatechange = () => {
        const state = this.peer.iceConnectionState;
        console.log('ICE connection state:', state);
        
        if (state === 'failed') {
          console.error('ICE connection failed, restarting...');
          this.restartIce();
        } else if (state === 'disconnected') {
          console.log('ICE disconnected, attempting recovery...');
          setTimeout(() => {
            if (this.peer && this.peer.iceConnectionState === 'disconnected') {
              this.restartIce();
            }
          }, 1000);
        }
      };

      // Handle ICE gathering state
      this.peer.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peer.iceGatheringState);
      };

      // Handle signaling state
      this.peer.onsignalingstatechange = () => {
        console.log('Signaling state:', this.peer.signalingState);
        
        // Reset negotiation flag if we're stable
        if (this.peer.signalingState === 'stable') {
          this.isNegotiating = false;
          this.hasRemoteDescription = true;
        }
      };

      // Listen for signals
      this.listenForSignals();

      // Create offer if initiator (with delay to ensure everything is set up)
      if (this.isInitiator) {
        setTimeout(() => {
          if (this.peer && !this.isNegotiating && !this.isEnded) {
            this.createOffer();
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Error creating peer connection:', error);
      this.connectionState = 'failed';
      throw error;
    }
  }

  async createOffer() {
    if (this.isNegotiating || this.isEnded) {
      console.log('Cannot create offer - already negotiating or ended');
      return;
    }
    
    try {
      console.log('Creating offer...');
      const offer = await this.peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart: true // Allow ICE restart
      });
      
      this.lastOffer = offer;
      
      // Prevent race condition: setLocalDescription before sending
      await this.peer.setLocalDescription(offer);
      console.log('Local description set for offer');
      
      // Send offer
      await this.sendSignal({
        type: 'offer',
        sdp: offer.sdp,
        senderId: this.isInitiator ? 'caller' : 'callee',
        timestamp: Date.now()
      });
      
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      
      // Check if it's the "stable" error
      if (error.message && error.message.includes('stable')) {
        console.log('Retrying offer creation after stability error');
        setTimeout(() => {
          if (this.peer && !this.isNegotiating) {
            this.createOffer();
          }
        }, 500);
      }
      throw error;
    }
  }

  async createAnswer(offer) {
    if (this.isNegotiating || this.isEnded) {
      console.log('Cannot create answer - already negotiating or ended');
      return;
    }
    
    try {
      console.log('Creating answer for offer...');
      
      // Validate offer
      if (!offer || !offer.sdp) {
        throw new Error('Invalid offer received');
      }
      
      // Only set remote description if we haven't already
      if (!this.peer.remoteDescription) {
        await this.peer.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: offer.sdp
        }));
        console.log('Remote description set for offer');
        
        // Apply any pending candidates
        this.processPendingCandidates();
      }
      
      const answer = await this.peer.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      this.lastAnswer = answer;
      
      await this.peer.setLocalDescription(answer);
      console.log('Local description set for answer');
      
      // Send answer
      await this.sendSignal({
        type: 'answer',
        sdp: answer.sdp,
        senderId: this.isInitiator ? 'caller' : 'callee',
        timestamp: Date.now()
      });
      
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  // Process pending ICE candidates
  processPendingCandidates() {
    console.log('Processing pending candidates:', this.pendingCandidates.length);
    const processed = [];
    
    this.pendingCandidates.forEach((candidate, index) => {
      try {
        if (this.peer.remoteDescription) {
          this.peer.addIceCandidate(new RTCIceCandidate(candidate));
          processed.push(index);
        }
      } catch (error) {
        console.warn('Failed to add pending candidate:', error);
      }
    });
    
    // Remove processed candidates
    this.pendingCandidates = this.pendingCandidates.filter((_, index) => 
      !processed.includes(index)
    );
  }

  async handleSignal(signal) {
    if (!this.peer || this.isEnded) {
      console.log('Peer not ready or call ended, ignoring signal');
      return;
    }
    
    try {
      console.log('Processing signal:', signal.type);
      
      if (signal.type === 'offer' && !this.isInitiator) {
        // Prevent duplicate offers
        if (this.lastOffer && this.lastOffer.sdp === signal.sdp) {
          console.log('Duplicate offer, ignoring');
          return;
        }
        
        await this.createAnswer(signal);
      } 
      else if (signal.type === 'answer' && this.isInitiator) {
        // Prevent duplicate answers
        if (this.lastAnswer && this.lastAnswer.sdp === signal.sdp) {
          console.log('Duplicate answer, ignoring');
          return;
        }
        
        // Only set if we don't have remote description
        if (!this.peer.remoteDescription || this.peer.remoteDescription.type !== 'answer') {
          await this.peer.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: signal.sdp
          }));
          console.log('Remote description set for answer');
          
          // Process pending candidates
          this.processPendingCandidates();
        }
      } 
      else if (signal.type === 'candidate') {
        // Validate candidate
        const candidate = signal.candidate;
        if (!candidate || !candidate.candidate || candidate.candidate.length === 0) {
          console.warn('Invalid candidate received');
          return;
        }
        
        // Fix for sdpMid/sdpMLineIndex being null
        const iceCandidate = new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid || '0',
          sdpMLineIndex: candidate.sdpMLineIndex || 0,
          usernameFragment: candidate.usernameFragment || ''
        });
        
        // Add candidate if we have remote description, otherwise queue it
        if (this.peer.remoteDescription) {
          try {
            await this.peer.addIceCandidate(iceCandidate);
          } catch (error) {
            // Some browsers throw errors for duplicate/obsolete candidates
            if (!error.toString().includes('duplicate') && !error.toString().includes('obsolete')) {
              console.warn('Failed to add ICE candidate:', error);
            }
          }
        } else {
          console.log('Queuing candidate (no remote description yet)');
          this.pendingCandidates.push(iceCandidate);
          
          // Limit queue size
          if (this.pendingCandidates.length > 50) {
            this.pendingCandidates.shift();
          }
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
      
      // Handle "stable" error specifically
      if (error.message && error.message.includes('stable')) {
        console.log('Stability error in signal handling, retrying in 500ms');
        setTimeout(() => {
          this.handleSignal(signal);
        }, 500);
      }
    }
  }

  // Send multiple signals at once
  async sendSignals(signals) {
    try {
      const signalRef = ref(database, `calls/${this.callId}/signals/${Date.now()}`);
      await set(signalRef, {
        signals: signals,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error sending signals:', error);
    }
  }

  // Send single signal
  async sendSignal(signal) {
    try {
      const signalRef = ref(database, `calls/${this.callId}/signals/${Date.now()}_${signal.type}`);
      await set(signalRef, {
        ...signal,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }

  // Listen for signals
  listenForSignals() {
    if (!this.signalingRef || this.signalingListener) {
      return;
    }
    
    this.signalingListener = onValue(this.signalingRef, (snapshot) => {
      const signals = snapshot.val();
      
      if (signals) {
        Object.keys(signals).forEach(key => {
          const signalData = signals[key];
          
          // Handle batch signals
          if (signalData.signals && Array.isArray(signalData.signals)) {
            signalData.signals.forEach(signal => {
              this.handleSignal(signal);
            });
          } else {
            // Handle single signal
            this.handleSignal(signalData);
          }
        });
      }
    });
  }

  // Helper to restart ICE
  async restartIce() {
    if (!this.peer || this.isEnded) {
      return;
    }
    
    try {
      console.log('Restarting ICE...');
      
      // Create a new offer with ICE restart
      const offer = await this.peer.createOffer({ iceRestart: true });
      await this.peer.setLocalDescription(offer);
      
      await this.sendSignal({
        type: 'offer',
        sdp: offer.sdp,
        senderId: this.isInitiator ? 'caller' : 'callee',
        iceRestart: true,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }

  // Handle track ended
  handleTrackEnded() {
    console.log('Track ended, checking connection...');
    if (this.peer) {
      // Check if all tracks are ended
      const senderTracks = this.peer.getSenders().map(sender => sender.track);
      const activeTracks = senderTracks.filter(track => track && track.readyState === 'live');
      
      if (activeTracks.length === 0) {
        console.log('All tracks ended, closing connection');
        this.endCall();
      }
    }
  }

  // Enhanced endCall with proper cleanup
  async endCall() {
    if (this.isEnded) {
      return; // Prevent multiple calls
    }
    
    this.isEnded = true;
    this.connectionState = 'closing';
    
    console.log('Ending call with cleanup...');
    
    try {
      // Stop all tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
            track.onended = null;
          } catch (error) {
            console.warn('Error stopping local track:', error);
          }
        });
      }
      
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          try {
            track.onended = null;
          } catch (error) {
            // Ignore
          }
        });
      }
      
      // Close peer connection
      if (this.peer) {
        try {
          // Remove all event listeners
          this.peer.onicecandidate = null;
          this.peer.ontrack = null;
          this.peer.onnegotiationneeded = null;
          this.peer.onconnectionstatechange = null;
          this.peer.oniceconnectionstatechange = null;
          this.peer.onicegatheringstatechange = null;
          this.peer.onsignalingstatechange = null;
          
          // Close connection
          this.peer.close();
        } catch (error) {
          console.warn('Error closing peer connection:', error);
        }
      }
      
      // Remove signaling listener
      if (this.signalingListener) {
        off(this.signalingRef, 'value', this.signalingListener);
        this.signalingListener = null;
      }
      
      // Remove signaling data
      if (this.signalingRef) {
        try {
          await remove(this.signalingRef);
        } catch (error) {
          console.warn('Could not remove signaling data:', error);
        }
      }
      
      console.log('Call ended and cleaned up successfully');
      
    } catch (error) {
      console.error('Error in endCall:', error);
    } finally {
      this.cleanup();
    }
  }

  // Enhanced cleanup
  cleanup() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingRef = null;
    this.signalingListener = null;
    this.callId = null;
    this.isNegotiating = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.remoteUserId = null;
    this.connectionState = 'disconnected';
    this.isEnded = true;
    this.isIceGatheringComplete = false;
    this.lastOffer = null;
    this.lastAnswer = null;
  }

  // Toggle mute
  toggleMute() {
    if (!this.localStream) return false;
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return true if muted
    }
    return false;
  }

  // Set callbacks
  setOnRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
  }

  setOnConnect(callback) {
    this.onConnectCallback = callback;
  }

  setOnError(callback) {
    this.onErrorCallback = callback;
  }

  setOnClose(callback) {
    this.onCloseCallback = callback;
  }
}

// Export singleton instance
const webRTCService = new WebRTCService();
export default webRTCService;