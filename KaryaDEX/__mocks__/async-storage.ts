// __mocks__/async-storage.ts
/**
 * In-memory mock for @react-native-async-storage/async-storage
 * for headless Jest testing.
 */

const storage = new Map<string, string>();

const AsyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return storage.has(key) ? storage.get(key)! : null;
  }),
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    storage.delete(key);
  }),
  clear: jest.fn(async (): Promise<void> => {
    storage.clear();
  }),
  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Array.from(storage.keys());
  }),
};

export default AsyncStorage;
