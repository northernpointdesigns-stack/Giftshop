import { CustomerDisplayState } from '../types/pos';

const CHANNEL_NAME = 'island_pos_customer_display';
const LOCAL_STORAGE_KEY = 'island_pos_customer_state';

const initialCustomerState: CustomerDisplayState = {
  cartItems: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  isCheckingOut: false,
  displayCurrency: 'primary',
  customMessage: 'Welcome to Island Breeze Retail! Standard & Consignment Goods',
};

class CustomerDisplayChannel {
  private channel: BroadcastChannel | null = null;
  private listeners: ((state: CustomerDisplayState) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data) {
          this.notifyListeners(event.data);
        }
      };
    }

    // Storage listener fallback for multi-window sync
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.notifyListeners(parsed);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public updateState(state: CustomerDisplayState) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }
    if (this.channel) {
      this.channel.postMessage(state);
    }
    this.notifyListeners(state);
  }

  public getCurrentState(): CustomerDisplayState {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }
    return initialCustomerState;
  }

  public subscribe(callback: (state: CustomerDisplayState) => void) {
    this.listeners.push(callback);
    // Send current state on initial subscribe
    callback(this.getCurrentState());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(state: CustomerDisplayState) {
    this.listeners.forEach((listener) => listener(state));
  }
}

export const customerChannel = new CustomerDisplayChannel();
