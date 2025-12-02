import 'webrtc-adapter';
import { database } from '../firebase/firebase';
import { ref, set, onValue, remove } from 'firebase/database';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingRef = null;
    this.callId = null;
    this.isInitiator = false;
    this.onRemoteStreamCallback = null;
    this.onConnectCallback = null;
    this.onErrorCallback = null;
    this.onCloseCallback = null;
  }

  // Initialize WebRTC connection
  async initializeCall(callId, isInitiator, userId, friendId) {
    this.callId = callId;
    this.isInitiator = isInitiator;
    
    // Setup signaling in Firebase Realtime Database
    this.signalingRef = ref(database, `calls/${callId}`);
    
    try {
      // Get user media (microphone)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      return this.localStream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      throw error;
    }
  }

  // Create peer connection using native WebRTC API (no simple-peer)
  createPeer(stream) {
    try {
      // Use native WebRTC
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      this.peer = new RTCPeerConnection(configuration);

      // Add local stream
      stream.getTracks().forEach(track => {
        this.peer.addTrack(track, stream);
      });

      // Handle remote stream
      this.peer.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      };

      // Handle ICE candidates
      this.peer.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      // Handle connection state
      this.peer.onconnectionstatechange = () => {
        if (this.peer.connectionState === 'connected') {
          console.log('WebRTC connected');
          if (this.onConnectCallback) {
            this.onConnectCallback();
          }
        } else if (this.peer.connectionState === 'failed' || 
                   this.peer.connectionState === 'disconnected' || 
                   this.peer.connectionState === 'closed') {
          console.log('WebRTC connection closed');
          if (this.onCloseCallback) {
            this.onCloseCallback();
          }
        }
      };

      // Handle errors
      this.peer.oniceconnectionstatechange = () => {
        if (this.peer.iceConnectionState === 'failed') {
          console.error('ICE connection failed');
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error('ICE connection failed'));
          }
        }
      };

      // Create offer if initiator
      if (this.isInitiator) {
        this.createOffer();
      }

      // Listen for signals
      this.listenForSignals();

    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  // Create offer
  async createOffer() {
    try {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      this.sendSignal({
        type: 'offer',
        sdp: offer.sdp
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Create answer
  async createAnswer(offer) {
    try {
      await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      this.sendSignal({
        type: 'answer',
        sdp: answer.sdp
      });
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  // Send signal data to Firebase
  sendSignal(data) {
    if (this.signalingRef) {
      const signalRef = ref(database, `calls/${this.callId}/signals/${Date.now()}`);
      set(signalRef, {
        sender: this.isInitiator ? 'caller' : 'callee',
        data: data
      }).catch(error => {
        console.error('Error sending signal:', error);
      });
    }
  }

  // Listen for incoming signals
  listenForSignals() {
    const signalsRef = ref(database, `calls/${this.callId}/signals`);
    
    onValue(signalsRef, (snapshot) => {
      const signals = snapshot.val();
      if (signals && this.peer) {
        Object.keys(signals).forEach(key => {
          const signal = signals[key];
          // Don't process our own signals
          if (signal.sender !== (this.isInitiator ? 'caller' : 'callee')) {
            this.handleSignal(signal.data);
          }
        });
      }
    });
  }

  // Handle incoming signal
  async handleSignal(signal) {
    if (!this.peer) return;

    try {
      if (signal.type === 'offer' && !this.isInitiator) {
        await this.createAnswer(signal);
      } else if (signal.type === 'answer' && this.isInitiator) {
        await this.peer.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === 'candidate' && this.peer.remoteDescription) {
        await this.peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }

  // Mute/unmute microphone
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return true if muted
      }
    }
    return false;
  }

  // Get mute status
  isMuted() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? !audioTrack.enabled : false;
    }
    return false;
  }

  // End call
  endCall() {
    try {
      if (this.peer) {
        this.peer.close();
      }
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (this.signalingRef) {
        remove(ref(database, `calls/${this.callId}`)).catch(error => {
          console.error('Error removing signaling data:', error);
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      this.cleanup();
    }
  }

  // Cleanup resources
  cleanup() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.signalingRef = null;
    this.callId = null;
  }

  // Callback setters
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