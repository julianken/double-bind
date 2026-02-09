/**
 * Memory monitoring service for React Native.
 *
 * Tracks memory usage, detects memory pressure, and triggers
 * appropriate actions to maintain app stability on mobile devices.
 */

import type {
  MemoryState,
  MemoryMonitorOptions,
  MemoryLeakDetectionConfig,
  MemoryLeakDetectionResult,
} from '@double-bind/types';
import { MemoryWarning } from '@double-bind/types';

/**
 * Default memory monitor configuration.
 */
const DEFAULT_OPTIONS: MemoryMonitorOptions = {
  interval: 5000, // Check every 5 seconds
  thresholds: {
    warning: 60, // 60% usage triggers warning
    critical: 80, // 80% usage triggers critical
  },
  autoEvictOnPressure: true,
};

/**
 * Memory monitor service for tracking and responding to memory pressure.
 */
export class MemoryMonitor {
  private options: MemoryMonitorOptions;
  private currentState: MemoryState | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private memoryHistory: MemoryState[] = [];
  private leakDetectionConfig: MemoryLeakDetectionConfig | null = null;

  constructor(options?: Partial<MemoryMonitorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start monitoring memory usage.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.updateMemoryState();
    this.intervalId = setInterval(() => {
      this.updateMemoryState();
    }, this.options.interval);
  }

  /**
   * Stop monitoring memory usage.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current memory state.
   */
  getMemoryState(): MemoryState | null {
    return this.currentState;
  }

  /**
   * Manually trigger a memory state update.
   */
  updateMemoryState(): void {
    const memInfo = this.getMemoryInfo();
    const usagePercentage = (memInfo.used / memInfo.available) * 100;
    const pressureLevel = this.calculatePressureLevel(usagePercentage);

    const newState: MemoryState = {
      used: memInfo.used,
      available: memInfo.available,
      pressureLevel,
      usagePercentage,
      timestamp: Date.now(),
    };

    // Check if warning level changed
    const oldLevel = this.currentState?.pressureLevel;
    if (oldLevel !== pressureLevel && this.options.onWarningLevelChange) {
      this.options.onWarningLevelChange(pressureLevel);
    }

    this.currentState = newState;

    // Store in history for leak detection
    if (this.leakDetectionConfig?.enabled) {
      this.memoryHistory.push(newState);
      if (this.memoryHistory.length > (this.leakDetectionConfig.sampleSize || 100)) {
        this.memoryHistory.shift();
      }
    }

    if (this.options.onMemoryStateChange) {
      this.options.onMemoryStateChange(newState);
    }
  }

  /**
   * Enable memory leak detection.
   */
  enableLeakDetection(config?: Partial<MemoryLeakDetectionConfig>): void {
    this.leakDetectionConfig = {
      enabled: true,
      sampleInterval: config?.sampleInterval || 10000, // 10 seconds
      sampleSize: config?.sampleSize || 100,
      growthRateThreshold: config?.growthRateThreshold || 1024 * 1024, // 1MB/second
    };
    this.memoryHistory = [];
  }

  /**
   * Disable memory leak detection.
   */
  disableLeakDetection(): void {
    this.leakDetectionConfig = null;
    this.memoryHistory = [];
  }

  /**
   * Analyze memory history for potential leaks.
   */
  detectLeaks(): MemoryLeakDetectionResult | null {
    if (!this.leakDetectionConfig?.enabled || this.memoryHistory.length < 10) {
      return null;
    }

    // Calculate memory growth rate using linear regression
    const growthRate = this.calculateGrowthRate(this.memoryHistory);
    const leakDetected = growthRate > (this.leakDetectionConfig.growthRateThreshold || 0);

    const recommendations: string[] = [];
    if (leakDetected) {
      recommendations.push('Memory usage is growing consistently over time');
      recommendations.push('Check for uncleared timers or intervals');
      recommendations.push('Review event listener registrations');
      recommendations.push('Inspect cache sizes and eviction policies');
      recommendations.push('Look for retained references preventing garbage collection');
    }

    return {
      leakDetected,
      growthRate,
      samples: this.memoryHistory.slice(),
      recommendations,
    };
  }

  /**
   * Calculate memory growth rate (bytes per second).
   */
  private calculateGrowthRate(samples: MemoryState[]): number {
    if (samples.length < 2) {
      return 0;
    }

    // Simple linear regression
    const n = samples.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    samples.forEach((sample, i) => {
      const x = i;
      const y = sample.used;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Convert slope to bytes per second
    const avgInterval = this.leakDetectionConfig?.sampleInterval || 10000;
    return (slope * 1000) / avgInterval;
  }

  /**
   * Get memory info from the system.
   * This is a platform-agnostic implementation.
   * In React Native, this would use native modules.
   */
  private getMemoryInfo(): { used: number; available: number } {
    // In a real React Native implementation, this would call:
    // - NativeModules.MemoryInfo.getMemoryInfo() on iOS
    // - NativeModules.MemoryInfo.getMemoryInfo() on Android
    //
    // For testing purposes, we simulate memory info
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = performance.memory as {
        usedJSHeapSize?: number;
        jsHeapSizeLimit?: number;
        totalJSHeapSize?: number;
      };
      return {
        used: memory.usedJSHeapSize || 0,
        available: memory.jsHeapSizeLimit || memory.totalJSHeapSize || 100 * 1024 * 1024,
      };
    }

    // Fallback for environments without memory API
    return {
      used: 50 * 1024 * 1024, // 50MB
      available: 200 * 1024 * 1024, // 200MB
    };
  }

  /**
   * Calculate memory pressure level based on usage percentage.
   */
  private calculatePressureLevel(usagePercentage: number): MemoryWarning {
    if (usagePercentage >= this.options.thresholds.critical) {
      return MemoryWarning.CRITICAL;
    }
    if (usagePercentage >= this.options.thresholds.warning) {
      return MemoryWarning.WARNING;
    }
    return MemoryWarning.NORMAL;
  }

  /**
   * Check if currently under memory pressure.
   */
  isUnderPressure(): boolean {
    return (
      this.currentState?.pressureLevel === MemoryWarning.WARNING ||
      this.currentState?.pressureLevel === MemoryWarning.CRITICAL
    );
  }

  /**
   * Get formatted memory usage string.
   */
  getFormattedMemoryUsage(): string {
    if (!this.currentState) {
      return 'Unknown';
    }

    const usedMB = (this.currentState.used / (1024 * 1024)).toFixed(2);
    const availableMB = (this.currentState.available / (1024 * 1024)).toFixed(2);
    const percentage = this.currentState.usagePercentage.toFixed(1);

    return `${usedMB} MB / ${availableMB} MB (${percentage}%)`;
  }
}
