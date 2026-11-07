const store: Record<string, string> = {};

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store[key] = value;
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store[key] ?? null;
}

export async function deleteItemAsync(key: string): Promise<void> {
  delete store[key];
}

export function __clearMockStore(): void {
  for (const k of Object.keys(store)) {
    delete store[k];
  }
}
