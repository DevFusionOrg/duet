import WebRTCService from './webrtc';
import callService from './callService';

export const videoService = {
  
  async checkMediaPermissions() {
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
      
      return {
        camera: cameraPermission.state,
        microphone: microphonePermission.state,
        canAsk: cameraPermission.state !== 'denied' && microphonePermission.state !== 'denied'
      };
    } catch (error) {
      
      return { camera: 'prompt', microphone: 'prompt', canAsk: true };
    }
  },

  async requestMediaAccess(constraints = {}) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 },
          ...constraints.video
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000,
          ...constraints.audio
        }
      });

      return {
        success: true,
        stream,
        videoTrack: stream.getVideoTracks()[0],
        audioTrack: stream.getAudioTracks()[0]
      };
    } catch (error) {
      return {
        success: false,
        error: this.getPermissionError(error),
        code: error.name
      };
    }
  },

  getPermissionError(error) {
    switch(error.name) {
      case 'NotAllowedError':
        return 'Camera/microphone access was denied. Please allow access in browser settings.';
      case 'NotFoundError':
        return 'No camera/microphone found on your device.';
      case 'NotReadableError':
        return 'Camera/microphone is in use by another application.';
      case 'OverconstrainedError':
        return 'Camera cannot provide the requested resolution.';
      case 'SecurityError':
        return 'Camera/microphone access is not allowed in this context (HTTPS required).';
      default:
        return 'Failed to access camera/microphone. Please check your device.';
    }
  },

  async switchCamera(currentStream, facingMode = 'user') {
    try {
      const videoTrack = currentStream.getVideoTracks()[0];
      if (!videoTrack) return null;

      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: newFacingMode
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      currentStream.removeTrack(videoTrack);
      currentStream.addTrack(newVideoTrack);

      videoTrack.stop();
      
      return {
        success: true,
        stream: currentStream,
        facingMode: newFacingMode
      };
    } catch (error) {
      console.error('Error switching camera:', error);
      return {
        success: false,
        error: 'Failed to switch camera'
      };
    }
  },

  async adjustVideoQuality(stream, quality = 'medium') {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return false;

    const qualityPresets = {
      'low': { width: 640, height: 480, frameRate: 15 },
      'medium': { width: 1280, height: 720, frameRate: 30 },
      'high': { width: 1920, height: 1080, frameRate: 30 }
    };

    const preset = qualityPresets[quality] || qualityPresets.medium;

    try {
      await videoTrack.applyConstraints({
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: preset.frameRate }
      });
      return true;
    } catch (error) {
      console.warn('Could not adjust video quality:', error);
      return false;
    }
  },

  async startVideoCall(callerId, callerName, receiverId, receiverName) {
    try {
      
      const mediaResult = await this.requestMediaAccess();
      if (!mediaResult.success) {
        throw new Error(mediaResult.error);
      }

      const callData = await callService.createVideoCall(
        callerId,
        callerName,
        receiverId,
        receiverName
      );

      return {
        success: true,
        callData,
        localStream: mediaResult.stream
      };
    } catch (error) {
      console.error('Error starting video call:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  toggleMedia(stream, type) {
    if (!stream) return false;
    
    if (type === 'video') {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled; 
      }
    } else if (type === 'audio') {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled; 
      }
    }
    return false;
  },

  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      return videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`,
        groupId: device.groupId
      }));
    } catch (error) {
      console.error('Error getting cameras:', error);
      return [];
    }
  },

  async switchToCamera(stream, deviceId) {
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return false;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId }
        },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      stream.removeTrack(videoTrack);
      stream.addTrack(newVideoTrack);
      videoTrack.stop();

      return true;
    } catch (error) {
      console.error('Error switching to specific camera:', error);
      return false;
    }
  },

  async togglePictureInPicture(videoElement) {
    if (!document.pictureInPictureEnabled) {
      return { success: false, error: 'Picture-in-Picture not supported' };
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return { success: true, mode: 'exited' };
      } else {
        await videoElement.requestPictureInPicture();
        return { success: true, mode: 'entered' };
      }
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default videoService;