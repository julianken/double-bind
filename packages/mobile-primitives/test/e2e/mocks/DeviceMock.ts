/**
 * Device Mock for Mobile E2E Tests
 *
 * Provides mock device capabilities and behaviors for testing without actual devices.
 * This allows tests to run in CI environments and during development.
 *
 * When Detox is installed, many of these mocks can be replaced with actual device interactions.
 */

/* eslint-disable no-console */

export interface DeviceInfo {
  platform: 'ios' | 'android';
  version: string;
  modelName: string;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

export interface DeviceCapabilities {
  hasNotch: boolean;
  supportsBiometrics: boolean;
  supportsKeyboard: boolean;
  maxMemoryMB: number;
}

/**
 * Mock device state for testing.
 */
export class DeviceMock {
  private info: DeviceInfo;
  private capabilities: DeviceCapabilities;
  private orientation: 'portrait' | 'landscape' = 'portrait';
  private memoryPressureLevel: 'normal' | 'low' | 'critical' = 'normal';

  constructor(platform: 'ios' | 'android' = 'ios') {
    this.info = this.getDefaultDeviceInfo(platform);
    this.capabilities = this.getDefaultCapabilities(platform);
  }

  private getDefaultDeviceInfo(platform: 'ios' | 'android'): DeviceInfo {
    if (platform === 'ios') {
      return {
        platform: 'ios',
        version: '17.0',
        modelName: 'iPhone 15 Pro',
        screenWidth: 393,
        screenHeight: 852,
        orientation: 'portrait',
      };
    } else {
      return {
        platform: 'android',
        version: '14.0',
        modelName: 'Pixel 6 Pro',
        screenWidth: 412,
        screenHeight: 915,
        orientation: 'portrait',
      };
    }
  }

  private getDefaultCapabilities(platform: 'ios' | 'android'): DeviceCapabilities {
    return {
      hasNotch: platform === 'ios',
      supportsBiometrics: true,
      supportsKeyboard: true,
      maxMemoryMB: platform === 'ios' ? 6144 : 8192,
    };
  }

  /**
   * Get current device information.
   */
  getDeviceInfo(): DeviceInfo {
    return { ...this.info };
  }

  /**
   * Get device capabilities.
   */
  getCapabilities(): DeviceCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Simulate device rotation.
   */
  async rotate(orientation: 'portrait' | 'landscape'): Promise<void> {
    console.log(`[DeviceMock] Rotating to ${orientation}`);
    this.orientation = orientation;
    this.info.orientation = orientation;

    if (orientation === 'landscape') {
      [this.info.screenWidth, this.info.screenHeight] = [
        this.info.screenHeight,
        this.info.screenWidth,
      ];
    }
  }

  /**
   * Get current orientation.
   */
  getOrientation(): 'portrait' | 'landscape' {
    return this.orientation;
  }

  /**
   * Simulate memory pressure (for testing memory management).
   */
  async simulateMemoryPressure(level: 'normal' | 'low' | 'critical'): Promise<void> {
    console.log(`[DeviceMock] Simulating memory pressure: ${level}`);
    this.memoryPressureLevel = level;
  }

  /**
   * Get current memory pressure level.
   */
  getMemoryPressureLevel(): 'normal' | 'low' | 'critical' {
    return this.memoryPressureLevel;
  }

  /**
   * Simulate background/foreground transitions.
   */
  async sendToBackground(duration: number = 2000): Promise<void> {
    console.log(`[DeviceMock] Sending app to background for ${duration}ms`);
    await new Promise((resolve) => setTimeout(resolve, duration));
    console.log(`[DeviceMock] Bringing app to foreground`);
  }

  /**
   * Simulate network conditions.
   */
  async setNetworkCondition(
    condition: 'online' | 'offline' | 'slow-3g' | 'fast-3g' | '4g'
  ): Promise<void> {
    console.log(`[DeviceMock] Setting network condition: ${condition}`);
  }

  /**
   * Simulate biometric authentication.
   */
  async authenticateBiometric(success: boolean = true): Promise<boolean> {
    console.log(`[DeviceMock] Biometric authentication: ${success ? 'success' : 'failure'}`);
    return success;
  }

  /**
   * Simulate keyboard show/hide.
   */
  async showKeyboard(): Promise<void> {
    console.log(`[DeviceMock] Showing keyboard`);
  }

  async hideKeyboard(): Promise<void> {
    console.log(`[DeviceMock] Hiding keyboard`);
  }

  /**
   * Get safe area insets (for notch/home indicator).
   */
  getSafeAreaInsets(): { top: number; right: number; bottom: number; left: number } {
    if (this.capabilities.hasNotch) {
      return {
        top: this.orientation === 'portrait' ? 44 : 0,
        right: this.orientation === 'landscape' ? 44 : 0,
        bottom: this.orientation === 'portrait' ? 34 : 21,
        left: this.orientation === 'landscape' ? 44 : 0,
      };
    }
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  /**
   * Simulate haptic feedback.
   */
  async triggerHaptic(
    type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
  ): Promise<void> {
    console.log(`[DeviceMock] Triggering haptic: ${type}`);
  }

  /**
   * Simulate system alerts/permissions.
   */
  async handleSystemAlert(action: 'allow' | 'deny'): Promise<void> {
    console.log(`[DeviceMock] Handling system alert: ${action}`);
  }

  /**
   * Simulate deep link.
   */
  async openDeepLink(url: string): Promise<void> {
    console.log(`[DeviceMock] Opening deep link: ${url}`);
  }

  /**
   * Simulate share action.
   */
  async triggerShareAction(content: string): Promise<void> {
    console.log(`[DeviceMock] Triggering share action with content: ${content}`);
  }

  /**
   * Reset device to default state.
   */
  async reset(): Promise<void> {
    console.log(`[DeviceMock] Resetting device to default state`);
    this.info = this.getDefaultDeviceInfo(this.info.platform);
    this.capabilities = this.getDefaultCapabilities(this.info.platform);
    this.orientation = 'portrait';
    this.memoryPressureLevel = 'normal';
  }
}

/**
 * Create device mock with platform-specific defaults.
 */
export function createDeviceMock(platform: 'ios' | 'android' = 'ios'): DeviceMock {
  return new DeviceMock(platform);
}

/**
 * Gesture mock for touch interactions.
 */
export class GestureMock {
  /**
   * Simulate tap gesture.
   */
  static async tap(x: number, y: number): Promise<void> {
    console.log(`[GestureMock] Tap at (${x}, ${y})`);
  }

  /**
   * Simulate long press gesture.
   */
  static async longPress(x: number, y: number, duration: number = 1000): Promise<void> {
    console.log(`[GestureMock] Long press at (${x}, ${y}) for ${duration}ms`);
  }

  /**
   * Simulate swipe gesture.
   */
  static async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number = 300
  ): Promise<void> {
    console.log(
      `[GestureMock] Swipe from (${startX}, ${startY}) to (${endX}, ${endY}) in ${duration}ms`
    );
  }

  /**
   * Simulate pinch gesture.
   */
  static async pinch(
    centerX: number,
    centerY: number,
    scale: number,
    duration: number = 300
  ): Promise<void> {
    console.log(
      `[GestureMock] Pinch at (${centerX}, ${centerY}) with scale ${scale} in ${duration}ms`
    );
  }

  /**
   * Simulate pan gesture.
   */
  static async pan(startX: number, startY: number, deltaX: number, deltaY: number): Promise<void> {
    console.log(`[GestureMock] Pan from (${startX}, ${startY}) by (${deltaX}, ${deltaY})`);
  }
}
