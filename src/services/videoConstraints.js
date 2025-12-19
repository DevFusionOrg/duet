export const videoConstraints = {
  
  presets: {
    'low': {
      width: { ideal: 640, max: 854 },
      height: { ideal: 480, max: 480 },
      frameRate: { ideal: 15, max: 20 },
      bitrate: 300000,
      bandwidth: 'low'
    },
    'medium': {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
      bitrate: 1000000,
      bandwidth: 'medium'
    },
    'high': {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      bitrate: 2500000,
      bandwidth: 'high'
    }
  },

  deviceConstraints: {
    'mobile': {
      width: { ideal: 720, max: 1080 },
      height: { ideal: 1280, max: 1920 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: { ideal: 'user' }
    },
    'tablet': {
      width: { ideal: 1080, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    },
    'desktop': {
      width: { ideal: 1280, max: 2560 },
      height: { ideal: 720, max: 1440 },
      frameRate: { ideal: 30, max: 60 }
    }
  },

  networkPresets: {
    'excellent': 'high',
    'good': 'medium',
    'poor': 'low',
    'very-poor': 'low'
  },

  getConstraints(deviceType = 'desktop', networkQuality = 'good') {
    const deviceConfig = this.deviceConstraints[deviceType] || this.deviceConstraints.desktop;
    const qualityPreset = this.networkPresets[networkQuality] || 'medium';
    const qualityConfig = this.presets[qualityPreset];

    return {
      video: {
        ...deviceConfig,
        ...qualityConfig,
        aspectRatio: 16/9
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
        sampleRate: 48000
      }
    };
  },

  detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;

    if (/mobile|android|iphone|ipad|ipod/.test(userAgent)) {
      return width > 768 ? 'tablet' : 'mobile';
    }
    return 'desktop';
  },

  async estimateNetworkQuality() {
    if (!navigator.connection) return 'good';

    const connection = navigator.connection;
    const { downlink, rtt, effectiveType } = connection;

    if (downlink > 5 && rtt < 100) return 'excellent';
    if (downlink > 2 && rtt < 200) return 'good';
    if (downlink > 0.5 && rtt < 500) return 'poor';
    return 'very-poor';
  },

  adjustQualityBasedOnFeedback(currentQuality, stats) {
    const { packetsLost, framesDropped, jitter } = stats;

    if (packetsLost > 10 || jitter > 100) {
      return this.downgradeQuality(currentQuality);
    }

    if (packetsLost < 1 && jitter < 20) {
      return this.upgradeQuality(currentQuality);
    }

    return currentQuality;
  },

  downgradeQuality(current) {
    const order = ['high', 'medium', 'low'];
    const index = order.indexOf(current);
    return index < order.length - 1 ? order[index + 1] : current;
  },

  upgradeQuality(current) {
    const order = ['low', 'medium', 'high'];
    const index = order.indexOf(current);
    return index > 0 ? order[index - 1] : current;
  },

  async getOptimizedConstraints() {
    const deviceType = this.detectDeviceType();
    const networkQuality = await this.estimateNetworkQuality();
    return this.getConstraints(deviceType, networkQuality);
  }
};

export default videoConstraints;