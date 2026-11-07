// __mocks__/expo-crypto.ts
export enum CryptoDigestAlgorithm {
  SHA1 = 'SHA-1',
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512',
  MD5 = 'MD5',
}

export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

export async function digestStringAsync(
  algorithm: CryptoDigestAlgorithm,
  data: string,
  options?: { encoding?: CryptoEncoding }
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const nodeAlg = algorithm.replace('-', '').toLowerCase();
    const hash = nodeCrypto.createHash(nodeAlg).update(data);
    return options?.encoding === CryptoEncoding.BASE64
      ? hash.digest('base64')
      : hash.digest('hex');
  } catch {
    // Basic fallback if node crypto is somehow unavailable
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

export function randomUUID(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomUUID();
  } catch {
    return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
