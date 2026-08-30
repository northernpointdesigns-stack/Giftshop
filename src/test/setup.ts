/**
 * Vitest global setup for the Reports test suite.
 *
 * Seeds localStorage with the deterministic fixture dataset BEFORE any app
 * module is imported (posDb loads its state from localStorage in its
 * constructor), and stubs the browser APIs jsdom lacks.
 */
import { vi } from 'vitest';
import { seedStorage } from './fixtures';

// ---- Seed the database before posDb is ever imported ----
seedStorage();

// ---- Blob download capture ----
const capturedBlobs: Blob[] = [];

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn((blob: Blob) => {
    capturedBlobs.push(blob);
    return `blob:mock-${capturedBlobs.length}`;
  }),
});

// jsdom's Blob may not implement .text() — provide a tolerant reader
export async function readBlobText(blob: Blob): Promise<string> {
  if (typeof (blob as { text?: () => Promise<string> }).text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export function getCapturedBlobs(): Blob[] {
  return capturedBlobs;
}

export function clearCapturedBlobs(): void {
  capturedBlobs.length = 0;
}

// URL.revokeObjectURL is not implemented in jsdom
if (typeof URL.revokeObjectURL !== 'function') {
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
} else {
  URL.revokeObjectURL = vi.fn();
}

// ---- Window / DOM stubs ----
window.print = vi.fn();
window.alert = vi.fn();
window.confirm = vi.fn(() => true);
window.scrollTo = vi.fn();
window.open = vi.fn(() => null);

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

Element.prototype.scrollIntoView = vi.fn();
