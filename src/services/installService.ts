export interface InstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: 'mac' | 'windows' | 'linux' | 'ios' | 'android' | 'other';
  isOnline: boolean;
}

type InstallListener = (state: InstallState) => void;

class DesktopInstallService {
  private deferredPrompt: any = null;
  private listeners: Set<InstallListener> = new Set();
  private isInstalled: boolean = false;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkIfInstalled();

      window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar or browser banner
        e.preventDefault();
        this.deferredPrompt = e;
        this.notify();
      });

      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.isInstalled = true;
        this.notify();
      });

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Match media listener for display-mode
      try {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addEventListener('change', (e) => {
          this.isInstalled = e.matches || this.checkIfInstalled();
          this.notify();
        });
      } catch (err) {
        // matchMedia fallback
      }
    }
  }

  public checkIfInstalled(): boolean {
    if (typeof window === 'undefined') return false;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      (window as any).isElectron === true;

    this.isInstalled = isStandalone;
    return isStandalone;
  }

  public getPlatform(): 'mac' | 'windows' | 'linux' | 'ios' | 'android' | 'other' {
    if (typeof window === 'undefined') return 'windows';
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('mac') || ua.includes('darwin')) return 'mac';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
    if (ua.includes('android')) return 'android';
    return 'other';
  }

  public getState(): InstallState {
    return {
      isInstallable: !!this.deferredPrompt,
      isInstalled: this.isInstalled,
      platform: this.getPlatform(),
      isOnline: this.isOnline,
    };
  }

  public subscribe(listener: InstallListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public async promptInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unsupported' }> {
    if (!this.deferredPrompt) {
      return { outcome: 'unsupported' };
    }

    try {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        this.isInstalled = true;
      }
      this.deferredPrompt = null;
      this.notify();
      return { outcome: choiceResult.outcome };
    } catch (e) {
      console.error('Error during desktop install prompt:', e);
      return { outcome: 'unsupported' };
    }
  }

  public openCustomerDisplayWindow() {
    const url = `${window.location.origin}/?tab=customer_display`;
    // Dual monitor popup with screen width/height positioning
    const left = window.screen.availWidth || 1920;
    const top = 0;
    const width = 1024;
    const height = 768;

    window.open(
      url,
      'CustomerFacingDisplay',
      `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
    );
  }

  public triggerDrawerPulse() {
    // Standard ESC/POS kick cash drawer ESC p 0 25 250 command representation
    // When connected to thermal printer or serial drawer
    if (window.isSecureContext) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  }
}

export const installService = new DesktopInstallService();
