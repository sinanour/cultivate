import { expect, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import 'fake-indexeddb/auto';

expect.extend(matchers);

// Polyfill localStorage for tests
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

beforeAll(() => {
  global.localStorage = new LocalStorageMock() as Storage;

  // Mock window.matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Suppress React error boundary console errors in tests
  // These are expected when testing error conditions
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    // Filter out React error boundary messages
    const message = args[0]?.toString() || '';
    if (
      message.includes('Error: useNotification must be used within') ||
      message.includes('The above error occurred in')
    ) {
      return;
    }
    originalError(...args);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});


