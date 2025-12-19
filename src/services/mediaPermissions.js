
import { secureOriginCheck } from '../utils/secureOriginCheck';

export const mediaPermissions = {
  
  async checkAndRequest(required = { video: true, audio: true }) {
    
    if (!secureOriginCheck.isSecureOrigin()) {
      return {
        success: false,
        error: 'SecurityError',
        message: `Camera/microphone access blocked on IP addresses. Access via localhost or enable in browser settings.`,
        isIPAddressIssue: true
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: required.audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: required.video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      });

      stream.getTracks().forEach(track => track.stop());
      
      return { 
        success: true,
        alreadyGranted: true
      };
    } catch (error) {
      console.error('Permission error:', error);
      return {
        success: false,
        error: error.name,
        message: this.getSimpleErrorMessage(error),
        isIPAddressIssue: error.name === 'NotAllowedError' && !secureOriginCheck.isSecureOrigin()
      };
    }
  },

  getSimpleErrorMessage(error) {
    
    if (!secureOriginCheck.isSecureOrigin() && error.name === 'NotAllowedError') {
      return `Permissions blocked on IP address (${window.location.hostname}). Access via localhost or check browser settings.`;
    }

    switch(error.name) {
      case 'NotAllowedError':
        return 'Camera/microphone access denied. Please allow in browser settings.';
      case 'NotFoundError':
        return 'No camera/microphone found.';
      case 'NotReadableError':
        return 'Camera/microphone is in use by another app.';
      case 'OverconstrainedError':
        return 'Camera resolution not supported.';
      case 'SecurityError':
        return 'Camera access blocked. Use localhost or enable in browser settings for IP addresses.';
      default:
        return 'Cannot access camera/microphone.';
    }
  },

  async checkAllPermissions() {
    const results = {
      camera: await this.checkPermission('camera'),
      microphone: await this.checkPermission('microphone'),
      notifications: await this.checkNotificationPermission()
    };

    return {
      ...results,
      allGranted: results.camera === 'granted' && results.microphone === 'granted',
      canAsk: results.camera !== 'denied' && results.microphone !== 'denied'
    };
  },

  async checkPermission(permissionName) {
    try {
      if (permissionName === 'camera' || permissionName === 'microphone') {
        const permission = await navigator.permissions.query({ 
          name: permissionName 
        });
        return permission.state;
      }
    } catch (error) {
      
      try {
        const constraints = permissionName === 'camera' 
          ? { video: true } 
          : { audio: true };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(track => track.stop());
        return 'granted';
      } catch {
        return 'denied';
      }
    }
  },

  async checkNotificationPermission() {
    return Notification.permission;
  },

  async requestMediaPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      return {
        success: true,
        stream,
        capabilities: await this.getStreamCapabilities(stream),
        devices: await this.getAvailableDevices()
      };
    } catch (error) {
      return {
        success: false,
        error: error.name,
        message: this.getSimpleErrorMessage(error)
      };
    }
  },

  async getStreamCapabilities(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    return {
      video: videoTrack ? videoTrack.getCapabilities() : null,
      audio: audioTrack ? audioTrack.getCapabilities() : null
    };
  },

  async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter(d => d.kind === 'videoinput'),
        microphones: devices.filter(d => d.kind === 'audioinput'),
        speakers: devices.filter(d => d.kind === 'audiooutput')
      };
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return { cameras: [], microphones: [], speakers: [] };
    }
  },

  onPermissionChange(permissionName, callback) {
    if (!navigator.permissions || !navigator.permissions.query) {
      return () => {};
    }

    navigator.permissions.query({ name: permissionName })
      .then(permissionStatus => {
        permissionStatus.onchange = () => {
          callback(permissionStatus.state);
        };
      })
      .catch(() => {});

    return () => {};
  },

  async testMediaQuality(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    return {
      video: videoTrack ? {
        width: videoTrack.getSettings().width,
        height: videoTrack.getSettings().height,
        frameRate: videoTrack.getSettings().frameRate,
        facingMode: videoTrack.getSettings().facingMode
      } : null,
      audio: audioTrack ? {
        sampleRate: audioTrack.getSettings().sampleRate,
        channelCount: audioTrack.getSettings().channelCount,
        echoCancellation: audioTrack.getSettings().echoCancellation
      } : null,
      timestamp: Date.now()
    };
  }
};

export default mediaPermissions;