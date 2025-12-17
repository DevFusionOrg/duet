/**
 * Utility to check if the app is running on a secure origin
 * and provide guidance for enabling permissions on IP addresses
 */

export const secureOriginCheck = {
  /**
   * Check if current origin is secure
   */
  isSecureOrigin() {
    if (typeof window === 'undefined') return true;
    
    const { protocol, hostname } = window.location;
    
    // HTTPS is always secure
    if (protocol === 'https:') return true;
    
    // localhost and 127.0.0.1 are secure on HTTP
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    
    // IP addresses on HTTP are NOT secure
    return false;
  },

  /**
   * Check if accessing via IP address
   */
  isIPAddress() {
    if (typeof window === 'undefined') return false;
    
    const { hostname } = window.location;
    
    // Check for IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    // Check for IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
  },

  /**
   * Get browser-specific instructions for enabling permissions on IP addresses
   */
  getBrowserInstructions() {
    const userAgent = navigator.userAgent.toLowerCase();
    const origin = window.location.origin;

    if (userAgent.includes('chrome') || userAgent.includes('edg')) {
      return {
        browser: 'Chrome/Edge',
        steps: [
          `Open Chrome and go to: chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
          `Add your IP address: ${origin}`,
          `Select "Enabled" from the dropdown`,
          `Click "Relaunch" button at the bottom`,
          `After restart, permissions should be available`
        ],
        shortUrl: 'chrome://flags/#unsafely-treat-insecure-origin-as-secure',
        alternativeSteps: [
          `Alternative: Start Chrome with flag:`,
          `--unsafely-treat-insecure-origin-as-secure="${origin}"`
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        browser: 'Firefox',
        steps: [
          `Type about:config in the address bar`,
          `Search for: media.devices.insecure.enabled`,
          `Set it to: true`,
          `Search for: media.getusermedia.insecure.enabled`,
          `Set it to: true`,
          `Restart Firefox`
        ],
        note: 'Firefox may still block IP addresses for security'
      };
    } else if (userAgent.includes('safari')) {
      return {
        browser: 'Safari',
        steps: [
          `Safari requires HTTPS for camera/microphone on IP addresses`,
          `Recommended: Use localhost instead of IP address`,
          `Or set up a local HTTPS certificate`
        ]
      };
    }

    return {
      browser: 'Unknown',
      steps: [
        `Your browser may not support camera/microphone access via IP addresses`,
        `Recommended solutions:`,
        `1. Access via localhost instead: http://localhost:3000`,
        `2. Set up HTTPS with a local certificate`,
        `3. Use Chrome/Edge with the chrome://flags method`
      ]
    };
  },

  /**
   * Get user-friendly warning message
   */
  getWarningMessage() {
    if (this.isSecureOrigin()) {
      return null;
    }

    if (this.isIPAddress()) {
      return {
        type: 'ip-address-warning',
        title: '⚠️ Limited Permissions on IP Address',
        message: `You're accessing via IP address (${window.location.hostname}). Browsers block camera, microphone, and notification permissions on IP addresses for security.`,
        severity: 'warning'
      };
    }

    return {
      type: 'insecure-origin',
      title: '⚠️ Insecure Connection',
      message: 'This site requires HTTPS for full functionality.',
      severity: 'warning'
    };
  },

  /**
   * Show modal with instructions
   */
  showInstructionsModal() {
    const instructions = this.getBrowserInstructions();
    const warning = this.getWarningMessage();
    
    return {
      ...warning,
      instructions,
      currentOrigin: window.location.origin,
      recommendedAction: this.isIPAddress() 
        ? `Access via localhost instead: ${window.location.origin.replace(window.location.hostname, 'localhost')}`
        : 'Enable HTTPS'
    };
  }
};
