import { LockinModule } from '../modules/expo-module-lockin/src';

describe('LockinModule Fallback & Web Compatibility', () => {
  it('has addBlockedPackages as a function and resolves successfully', async () => {
    expect(typeof LockinModule.addBlockedPackages).toBe('function');
    await expect(LockinModule.addBlockedPackages(['com.instagram.android'])).resolves.toBeUndefined();
    await expect(LockinModule.addBlockedPackages([])).resolves.toBeUndefined();
  });

  it('provides safe fallbacks for blocking and session methods', async () => {
    expect(typeof LockinModule.removeBlockedPackages).toBe('function');
    await expect(LockinModule.removeBlockedPackages(['com.instagram.android'])).resolves.toBeUndefined();

    const blocked = await LockinModule.getBlockedPackages();
    expect(Array.isArray(blocked)).toBe(true);

    const state = await LockinModule.getSessionState();
    expect(state).toEqual({ remainingSeconds: 0, isActive: false });

    const hasPerms = await LockinModule.hasAllPermissions();
    expect(hasPerms).toBe(false);
  });

  it('safely handles unknown or newly added methods without throwing TypeError', async () => {
    const dynamicMethod = (LockinModule as any).nonExistentMethod;
    expect(typeof dynamicMethod).toBe('function');
    await expect(dynamicMethod()).resolves.toBeUndefined();
  });
});
