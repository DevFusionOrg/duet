/**
 * Performance Monitor
 * Tracks and logs performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: [],
      chatOpen: [],
      messageRender: [],
      imageLoad: [],
      firebaseQuery: [],
    };
    this.observers = [];
  }

  /**
   * Measure page load performance
   */
  measurePageLoad() {
    if (typeof window === 'undefined' || !window.performance) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;
        const connectTime = perfData.responseEnd - perfData.requestStart;

        this.recordMetric('pageLoad', {
          total: pageLoadTime,
          domReady: domReadyTime,
          connect: connectTime,
          timestamp: Date.now(),
        });

        console.log(`[Performance] Page load: ${pageLoadTime}ms`);
      }, 0);
    });
  }

  /**
   * Measure chat open time
   */
  startChatTimer(chatId) {
    return {
      chatId,
      startTime: performance.now(),
      end: () => {
        const duration = performance.now() - this.startTime;
        this.recordMetric('chatOpen', {
          chatId,
          duration,
          timestamp: Date.now(),
        });
        console.log(`[Performance] Chat opened in ${duration.toFixed(2)}ms`);
        return duration;
      },
    };
  }

  /**
   * Measure message rendering
   */
  measureMessageRender(messageCount) {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric('messageRender', {
        messageCount,
        duration,
        timestamp: Date.now(),
      });
      
      if (duration > 100) {
        console.warn(`[Performance] Slow message render: ${duration.toFixed(2)}ms for ${messageCount} messages`);
      }
      
      return duration;
    };
  }

  /**
   * Measure image load time
   */
  measureImageLoad(url) {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric('imageLoad', {
        url,
        duration,
        timestamp: Date.now(),
      });
      
      if (duration > 1000) {
        console.warn(`[Performance] Slow image load: ${duration.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Measure Firebase query time
   */
  measureFirebaseQuery(queryName) {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric('firebaseQuery', {
        queryName,
        duration,
        timestamp: Date.now(),
      });
      
      if (duration > 500) {
        console.warn(`[Performance] Slow Firebase query "${queryName}": ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    };
  }

  /**
   * Record a custom metric
   */
  recordMetric(type, data) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    this.metrics[type].push(data);
    
    // Keep only last 100 entries
    if (this.metrics[type].length > 100) {
      this.metrics[type] = this.metrics[type].slice(-100);
    }
  }

  /**
   * Get average for a metric type
   */
  getAverage(type) {
    const metrics = this.metrics[type];
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + (m.duration || m.total || 0), 0);
    return sum / metrics.length;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    return {
      pageLoad: {
        count: this.metrics.pageLoad.length,
        average: this.getAverage('pageLoad'),
      },
      chatOpen: {
        count: this.metrics.chatOpen.length,
        average: this.getAverage('chatOpen'),
      },
      messageRender: {
        count: this.metrics.messageRender.length,
        average: this.getAverage('messageRender'),
      },
      imageLoad: {
        count: this.metrics.imageLoad.length,
        average: this.getAverage('imageLoad'),
      },
      firebaseQuery: {
        count: this.metrics.firebaseQuery.length,
        average: this.getAverage('firebaseQuery'),
      },
    };
  }

  /**
   * Log performance summary
   */
  logSummary() {
    const summary = this.getSummary();
    console.table(summary);
  }

  /**
   * Monitor memory usage
   */
  getMemoryUsage() {
    if (!performance.memory) return null;
    
    return {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
    };
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring(intervalMs = 30000) {
    this.memoryInterval = setInterval(() => {
      const memory = this.getMemoryUsage();
      if (memory) {
        console.log('[Performance] Memory usage:', memory);
        
        // Warn if memory usage is high
        const usedMB = parseFloat(memory.usedJSHeapSize);
        if (usedMB > 100) {
          console.warn('[Performance] High memory usage detected:', memory);
        }
      }
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {
      pageLoad: [],
      chatOpen: [],
      messageRender: [],
      imageLoad: [],
      firebaseQuery: [],
    };
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  React.useEffect(() => {
    performanceMonitor.measurePageLoad();
    performanceMonitor.startMemoryMonitoring();

    return () => {
      performanceMonitor.stopMemoryMonitoring();
    };
  }, []);

  return {
    startChatTimer: performanceMonitor.startChatTimer.bind(performanceMonitor),
    measureMessageRender: performanceMonitor.measureMessageRender.bind(performanceMonitor),
    measureImageLoad: performanceMonitor.measureImageLoad.bind(performanceMonitor),
    measureFirebaseQuery: performanceMonitor.measureFirebaseQuery.bind(performanceMonitor),
    getSummary: performanceMonitor.getSummary.bind(performanceMonitor),
    logSummary: performanceMonitor.logSummary.bind(performanceMonitor),
    getMemoryUsage: performanceMonitor.getMemoryUsage.bind(performanceMonitor),
  };
}

export default performanceMonitor;
