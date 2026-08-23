import { CartItem, Customer } from '../types/pos';

export interface CustomerDisplayState {
  cart: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  secondaryTotal: number;
  exchangeRate: number;
  attachedCustomer?: Customer | null;
  status: 'idle' | 'scanning' | 'payment' | 'completed';
  lastScannedItem?: CartItem | null;
  paymentDetails?: {
    method: string;
    tendered: number;
    changeDue: number;
    currency: string;
    receiptNumber: string;
  } | null;
}

const CHANNEL_NAME = 'seychelles_pos_customer_display';

class CustomerChannelService {
  private channel: BroadcastChannel | null = null;
  private listeners: ((state: CustomerDisplayState) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data) {
          this.listeners.forEach((listener) => listener(event.data));
        }
      };
    }
  }

  public broadcast(state: CustomerDisplayState) {
    try {
      if (this.channel) {
        this.channel.postMessage(state);
      }
      // Also cache in localStorage for newly opened secondary windows
      localStorage.setItem('pos_customer_display_state', JSON.stringify(state));
    } catch {
      // Local broadcast fallback
    }
  }

  public subscribe(callback: (state: CustomerDisplayState) => void) {
    this.listeners.push(callback);

    // Initial load from storage if present
    try {
      const saved = localStorage.getItem('pos_customer_display_state');
      if (saved) {
        callback(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }
}

export const customerChannel = new CustomerChannelService();
