export const mediaPermissions = {
  /**
   * Comprehensive permission check
   */
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

  /**
   * Check specific permission
   */
  async checkPermission(permissionName) {
    try {
      // For camera and microphone
      if (permissionName === 'camera' || permissionName === 'microphone') {
        const permission = await navigator.permissions.query({ 
          name: permissionName 
        });
        return permission.state;
      }
    } catch (error) {
      // Fallback: try to get media to check
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

  /**
   * Check notification permission
   */
  async checkNotificationPermission() {
    return Notification.permission;
  },

  /**
   * Request all media permissions
   */
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

      // Get device capabilities
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      return {
        success: true,
        stream,
        capabilities: {
          video: videoTrack ? videoTrack.getCapabilities() : null,
          audio: audioTrack ? audioTrack.getCapabilities() : null,
          devices: await this.getAvailableDevices()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  /**
   * Get available media devices
   */
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

  /**
   * Get user-friendly error messages
   */
  getErrorMessage(error) {
    const errors = {
      'NotAllowedError': {
        title: 'Permission Denied',
        message: 'Camera/microphone access was denied. Please allow access in your browser settings.',
        instructions: [
          'Click the camera/microphone icon in your browser\'s address bar',
          'Select "Always allow" for this site',
          'Refresh the page and try again'
        ]
      },
      'NotFoundError': {
        title: 'No Camera/Microphone Found',
        message: 'No camera or microphone was detected on your device.',
        instructions: [
          'Check if a camera/microphone is connected',
          'Make sure no other app is using the camera/microphone',
          'Try using a different device'
        ]
      },
      'NotReadableError': {
        title: 'Device in Use',
        message: 'Camera/microphone is currently in use by another application.',
        instructions: [
          'Close other apps using the camera/microphone',
          'Restart your browser',
          'Try a different browser'
        ]
      },
      'OverconstrainedError': {
        title: 'Unsupported Resolution',
        message: 'Your camera doesn\'t support the requested resolution.',
        instructions: [
          'Try using a different camera',
          'Use lower quality settings',
          'Update your camera drivers'
        ]
      },
      'SecurityError': {
        title: 'Security Restriction',
        message: 'Camera access requires a secure connection (HTTPS).',
        instructions: [
          'Make sure you\'re using https://',
          'Check if your connection is secure',
          'Try on a different network'
        ]
      }
    };

    const defaultError = {
      title: 'Permission Error',
      message: 'Failed to access camera/microphone.',
      instructions: ['Please check your device permissions and try again.']
    };

    return errors[error.name] || defaultError;
  },

  /**
   * Monitor permission changes
   */
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

  /**
   * Test audio/video quality
   */
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