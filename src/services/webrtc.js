// webrtc.js - stable WebRTC service for Duet
import { database } from '../firebase/firebase';
import { ref, set, onValue, remove, off } from 'firebase/database';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingRef = null;
    this.signalingListener = null;
    this.callId = null;
    this.isInitiator = false;
    this.remoteUserId = null;

    // Callbacks
    this.onRemoteStreamCallback = null;
    this.onConnectCallback = null;
    this.onErrorCallback = null;
    this.onCloseCallback = null;
    this.onDisconnectCallback = null;

    // State
    this.isNegotiating = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.connectionState = 'disconnected';
    this.isEnded = false;

    // ICE gathering
    this.isIceGatheringComplete = false;

    // Offer/answer tracking
    this.lastOffer = null;
    this.lastAnswer = null;

    // Reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectTimer = null;

    // Signal batching (for candidates)
    this.signalQueue = [];
    this.signalQueueTimer = null;
  }

  async initializeCall(callId, isInitiator, userId, friendId) {
    // If a call is already active, end it first
    if (this.peer && !this.isEnded) {
      console.warn('Call already initialized, cleaning up first');
      await this.endCall(false);
    }

    // Reset state
    this.isEnded = false;
    this.callId = callId;
    this.isInitiator = isInitiator;
    this.remoteUserId = isInitiator ? friendId : userId;
    this.connectionState = 'initializing';
    this.reconnectAttempts = 0;
    this.isNegotiating = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.isIceGatheringComplete = false;
    this.lastOffer = null;
    this.lastAnswer = null;
    this.signalQueue = [];

    // Signaling path
    this.signalingRef = ref(database, `callSignals/${callId}`);

    // Only the initiator clears old signaling data
    if (isInitiator) {
      try {
        await remove(this.signalingRef);
      } catch (error) {
        console.warn('Could not clear previous signaling data:', error);
      }
    }

    try {
      // Get user media
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

      // Debug track events
      this.localStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('Local track ended:', track.kind);
          this.handleTrackEnded();
        };
        track.onmute = () => console.log('Local track muted:', track.kind);
        track.onunmute = () => console.log('Local track unmuted:', track.kind);
      });

      // Create RTCPeerConnection
      this.createPeerConnection(this.localStream);

      // Start listening for signals
      this.listenForSignals();

      return this.localStream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.connectionState = 'failed';
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      throw error;
    }
  }

  createPeerConnection(stream) {
    try {
      // Close existing peer if any
      if (this.peer && this.peer.connectionState !== 'closed') {
        try {
          this.peer.close();
        } catch (e) {
          console.warn('Error closing existing peer:', e);
        }
      }

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.ekiga.net' },
          { urls: 'stun:stun.ideasip.com' },
          { urls: 'stun:stun.rixtelecom.se' },
          { urls: 'stun:stun.schlund.de' },
          { urls: 'stun:stun.stunprotocol.org:3478' }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      this.peer = new RTCPeerConnection(configuration);
      this.connectionState = 'new';

      // Browser debugging
      if (navigator.userAgent.includes('Edg')) {
        console.log('🔍 Microsoft Edge detected, adding debug handlers');
        this.peer.onicecandidateerror = (event) => {
          console.error('ICE candidate error (Edge):', event);
        };
        console.log('Edge User Agent:', navigator.userAgent);
      } else if (navigator.userAgent.includes('Chrome')) {
        console.log('🔍 Chrome detected');
      }
      console.log('WebRTC Support:');
      console.log('- RTCPeerConnection:', typeof RTCPeerConnection);
      console.log('- RTCSessionDescription:', typeof RTCSessionDescription);
      console.log('- RTCIceCandidate:', typeof RTCIceCandidate);

      // Reset negotiation state
      this.isNegotiating = false;
      this.hasRemoteDescription = false;
      this.pendingCandidates = [];
      this.isIceGatheringComplete = false;
      this.lastOffer = null;
      this.lastAnswer = null;

      // Add local tracks
      stream.getTracks().forEach(track => {
        try {
          this.peer.addTrack(track, stream);
        } catch (error) {
          console.error('Error adding track:', error);
        }
      });

      // Remote stream handler
      this.peer.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];

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

      // ICE candidate handling (batched)
      let iceCandidateQueue = [];
      let iceCandidateTimer = null;

      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate;
          if (candidate.candidate && candidate.candidate.length > 0) {
            iceCandidateQueue.push({
              type: 'candidate',
              candidate: {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid || '0',
                sdpMLineIndex: candidate.sdpMLineIndex || 0,
                usernameFragment: candidate.usernameFragment || ''
              },
              timestamp: Date.now()
            });

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
          console.log('ICE gathering complete');
          this.isIceGatheringComplete = true;
        }
      };

      // Negotiation – only initiator creates offers
      this.peer.onnegotiationneeded = async () => {
        console.log('onnegotiationneeded fired');

        if (!this.isInitiator) {
          console.log('Not initiator, skipping negotiation');
          return;
        }
        if (this.isEnded || !this.peer) {
          console.log('Call ended or no peer, skipping negotiation');
          return;
        }
        if (this.isNegotiating) {
          console.log('Already negotiating, skipping');
          return;
        }

        try {
          console.log('onnegotiationneeded → creating initial offer');
          await this.createOffer(false);
        } catch (error) {
          console.error('Negotiation error:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
        }
      };

      // Connection state changes
      this.peer.onconnectionstatechange = () => {
        const state = this.peer.connectionState;
        console.log('Connection state changed:', state);
        this.connectionState = state;

        switch (state) {
          case 'connected':
            console.log('✅ WebRTC connection established');
            this.reconnectAttempts = 0;
            if (this.onConnectCallback) {
              this.onConnectCallback();
            }
            break;
          case 'disconnected':
            console.log('⚠️ WebRTC disconnected');
            if (this.onDisconnectCallback) {
              this.onDisconnectCallback();
            }
            this.attemptReconnection();
            break;
          case 'failed':
            console.error('WebRTC connection failed');
            this.reconnectAttempts = 0;
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
          default:
            console.log('Unknown connection state:', state);
            break;
        }
      };

      // ICE connection state
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

      this.peer.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peer.iceGatheringState);
      };

      this.peer.onsignalingstatechange = () => {
        console.log('Signaling state:', this.peer.signalingState);
        if (this.peer.signalingState === 'stable') {
          this.isNegotiating = false;
          this.hasRemoteDescription = true;
        }
      };

      // ⛔️ NO extra delayed createOffer here; onnegotiationneeded handles it.

    } catch (error) {
      console.error('Error creating peer connection:', error);
      this.connectionState = 'failed';
      throw error;
    }
  }

  // Create offer (caller only)
  async createOffer(iceRestart = false) {
    if (this.isEnded) {
      console.log('Cannot create offer - call ended');
      return;
    }
    if (!this.peer) {
      console.log('Cannot create offer - no peer');
      return;
    }
    if (this.isNegotiating) {
      console.log('Already negotiating, skipping createOffer');
      return;
    }

    this.isNegotiating = true;

    try {
      console.log('Creating offer...', iceRestart ? '(ICE restart)' : '');
      const offer = await this.peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        iceRestart
      });

      this.lastOffer = offer;

      await this.peer.setLocalDescription(offer);
      console.log('Local description set for offer');

      await this.sendSignal({
        type: 'offer',
        sdp: offer.sdp,
        senderId: this.isInitiator ? 'caller' : 'callee',
        timestamp: Date.now()
      });

      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    } finally {
      this.isNegotiating = false;
    }
  }

  // Create answer (callee)
  async createAnswer(offer) {
    if (this.isNegotiating || this.isEnded) {
      console.log('Cannot create answer - already negotiating or ended');
      return;
    }
    if (!this.peer) {
      console.log('Cannot create answer - no peer');
      return;
    }

    try{
      console.log('Creating answer for offer...');

      if (!offer || !offer.sdp) {
        throw new Error('Invalid offer received');
      }

      const currentRemoteDesc = this.peer.remoteDescription;
      if (!currentRemoteDesc || currentRemoteDesc.type !== 'offer') {
        await this.peer.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: offer.sdp
        }));
        console.log('Remote description set for offer');
        this.processPendingCandidates();
      }

      const answer = await this.peer.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      this.lastAnswer = answer;

      await this.peer.setLocalDescription(answer);
      console.log('Local description set for answer');

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

  processPendingCandidates() {
    console.log('Processing pending candidates:', this.pendingCandidates.length);
    const processed = [];

    this.pendingCandidates.forEach((candidate, index) => {
      try {
        if (this.peer && this.peer.remoteDescription) {
          this.peer.addIceCandidate(new RTCIceCandidate(candidate));
          processed.push(index);
        }
      } catch (error) {
        console.warn('Failed to add pending candidate:', error);
      }
    });

    this.pendingCandidates = this.pendingCandidates.filter((_, index) => !processed.includes(index));
  }

  async handleSignal(signal) {
    console.log('🔍 handleSignal called - Peer exists?', !!this.peer);
    console.log('🔍 isEnded?', this.isEnded);
    console.log('🔍 Connection state:', this.connectionState);

    if (this.isEnded) {
      console.log('Call already ended, ignoring signal of type:', signal.type);
      return;
    }

    if (!this.peer) {
      console.log('Peer not ready or call ended, ignoring signal');
      return;
    }

    try {
      console.log('Processing signal:', signal.type, 'from:', signal.senderId);

      if (signal.type === 'offer' && !this.isInitiator) {
        // Callee
        if (this.lastOffer && this.lastOffer.sdp === signal.sdp) {
          console.log('Duplicate offer, ignoring');
          return;
        }

        this.lastOffer = signal;
        await this.createAnswer(signal);

      } else if (signal.type === 'answer' && this.isInitiator) {
        // Caller
        if (this.lastAnswer && this.lastAnswer.sdp === signal.sdp) {
          console.log('Duplicate answer, ignoring');
          return;
        }

        this.lastAnswer = signal;
        const currentRemoteDesc = this.peer.remoteDescription;
        if (!currentRemoteDesc || currentRemoteDesc.type !== 'answer') {
          await this.peer.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: signal.sdp
          }));
          console.log('Remote description set for answer');
          this.processPendingCandidates();
        }

      } else if (signal.type === 'candidate') {
        const candidate = signal.candidate;
        if (!candidate || !candidate.candidate || candidate.candidate.length === 0) {
          console.warn('Invalid candidate received');
          return;
        }

        const iceCandidate = new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid || '0',
          sdpMLineIndex: candidate.sdpMLineIndex || 0,
          usernameFragment: candidate.usernameFragment || ''
        });

        if (this.peer.remoteDescription) {
          try {
            await this.peer.addIceCandidate(iceCandidate);
          } catch (error) {
            if (!error.toString().includes('duplicate') && !error.toString().includes('obsolete')) {
              console.warn('Failed to add ICE candidate:', error);
            }
          }
        } else {
          console.log('Queuing candidate (no remote description yet)');
          this.pendingCandidates.push(iceCandidate);
          if (this.pendingCandidates.length > 50) {
            this.pendingCandidates.shift();
          }
        }

      } else if (signal.type === 'end-call') {
        console.log('Received end call signal');
        // Do not send another end-call back
        await this.endCall(false);
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }

  async sendSignals(signals) {
    try {
      const signalRef = ref(database, `callSignals/${this.callId}/${Date.now()}_batch`);
      await set(signalRef, {
        signals,
        timestamp: Date.now(),
        senderId: this.isInitiator ? 'caller' : 'callee'
      });
    } catch (error) {
      console.error('Error sending signals:', error);
    }
  }

  async sendSignal(signal) {
    try {
      const signalRef = ref(database, `callSignals/${this.callId}/${Date.now()}_${signal.type}`);
      await set(signalRef, {
        ...signal,
        timestamp: Date.now(),
        senderId: this.isInitiator ? 'caller' : 'callee'
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }

  async sendEndCallSignal() {
    try {
      const signalRef = ref(database, `callSignals/${this.callId}/${Date.now()}_end`);
      await set(signalRef, {
        type: 'end-call',
        timestamp: Date.now(),
        senderId: this.isInitiator ? 'caller' : 'callee'
      });
    } catch (error) {
      console.error('Error sending end call signal:', error);
    }
  }

  listenForSignals() {
    if (!this.signalingRef || this.signalingListener) {
      return;
    }

    this.signalingListener = onValue(this.signalingRef, (snapshot) => {
      const signals = snapshot.val();

      if (signals) {
        Object.keys(signals).forEach(key => {
          const signalData = signals[key];

          if (signalData.signals && Array.isArray(signalData.signals)) {
            signalData.signals.forEach(signal => {
              this.handleSignal(signal);
            });
          } else {
            this.handleSignal(signalData);
          }
        });
      }
    }, (error) => {
      console.error('Error listening for signals:', error);
    });
  }

  // ICE restart → just another offer with iceRestart = true
  async restartIce() {
    if (!this.peer || this.isEnded) {
      return;
    }

    try {
      console.log('Restarting ICE...');
      await this.createOffer(true);
    } catch (error) {
      console.error('Error restarting ICE:', error);
    }
  }

  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isEnded) {
      console.log('Max reconnection attempts reached or call ended');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectTimer = setTimeout(async () => {
      if (this.peer && this.peer.connectionState === 'disconnected' && !this.isEnded) {
        console.log('Attempting to reconnect...');
        await this.restartIce();
      }
    }, 2000 * this.reconnectAttempts);
  }

  handleTrackEnded() {
    console.log('Track ended, checking connection...');
    if (this.peer) {
      const senderTracks = this.peer.getSenders().map(sender => sender.track);
      const activeTracks = senderTracks.filter(track => track && track.readyState === 'live');

      if (activeTracks.length === 0) {
        console.log('All tracks ended, closing connection');
        this.endCall();
      }
    }
  }

  // sendSignalFlag = false when we are responding to remote end-call
  async endCall(sendSignalFlag = true) {
    if (this.isEnded) {
      return;
    }

    this.isEnded = true;
    this.connectionState = 'closing';

    console.log('Ending call with cleanup...');

    if (sendSignalFlag) {
      await this.sendEndCallSignal();
    }

    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
            track.onended = null;
            track.onmute = null;
            track.onunmute = null;
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
            // ignore
          }
        });
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.peer) {
        try {
          this.peer.onicecandidate = null;
          this.peer.ontrack = null;
          this.peer.onnegotiationneeded = null;
          this.peer.onconnectionstatechange = null;
          this.peer.oniceconnectionstatechange = null;
          this.peer.onicegatheringstatechange = null;
          this.peer.onsignalingstatechange = null;
          this.peer.close();
        } catch (error) {
          console.warn('Error closing peer connection:', error);
        }
      }

      if (this.signalingListener && this.signalingRef) {
        off(this.signalingRef, 'value', this.signalingListener);
        this.signalingListener = null;
      }

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
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.signalQueue = [];
    if (this.signalQueueTimer) {
      clearTimeout(this.signalQueueTimer);
      this.signalQueueTimer = null;
    }
  }

  // Mute / unmute local mic
  toggleMute() {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // true = muted
    }
    return false;
  }

  async getConnectionStats() {
    if (!this.peer) return null;
    try {
      const stats = await this.peer.getStats();
      const result = {};
      stats.forEach(report => {
        result[report.type] = report;
      });
      return result;
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

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

  setOnDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }
}

const webRTCService = new WebRTCService();
export default webRTCService;
