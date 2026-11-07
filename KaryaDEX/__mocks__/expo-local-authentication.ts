// __mocks__/expo-local-authentication.ts
export enum AuthenticationType {
  FINGERPRINT = 1,
  FACIAL_RECOGNITION = 2,
  IRIS = 3,
}

export enum SecurityLevel {
  NONE = 0,
  SECRET = 1,
  BIOMETRIC = 2,
}

export async function hasHardwareAsync(): Promise<boolean> {
  return true;
}

export async function isEnrolledAsync(): Promise<boolean> {
  return true;
}

export async function supportedAuthenticationTypesAsync(): Promise<AuthenticationType[]> {
  return [AuthenticationType.FINGERPRINT, AuthenticationType.FACIAL_RECOGNITION];
}

export async function getEnrolledLevelAsync(): Promise<SecurityLevel> {
  return SecurityLevel.BIOMETRIC;
}

export async function authenticateAsync(options?: {
  promptMessage?: string;
  cancelLabel?: string;
  disableDeviceFallback?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}
