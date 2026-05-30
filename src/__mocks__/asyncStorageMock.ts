// Minimal in-memory stand-in for @react-native-async-storage/async-storage,
// used by the Jest suite so storage.ts can be exercised without a native runtime.
const store: Record<string, string> = {};

export default {
  getItem: jest.fn(async (key: string): Promise<string | null> =>
    Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
  ),
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    store[key] = value;
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete store[key];
  }),
  clear: jest.fn(async (): Promise<void> => {
    for (const k of Object.keys(store)) delete store[k];
  }),
  __store: store,
};
