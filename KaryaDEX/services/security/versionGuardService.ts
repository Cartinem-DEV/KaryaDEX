/**
 * BunkMatKar — Version Guard & Security Update Enforcement Service (Phase 11.5)
 *
 * Implements server-controlled minimum supported application version enforcement:
 * 1. Checks if current app version meets security baselines.
 * 2. Differentiates soft recommendations vs mandatory critical security updates.
 * 3. Graceful offline fallback avoids bricking the app if backend is unreachable.
 */

export interface VersionPolicy {
  minimumSupportedVersion: string;
  latestVersion: string;
  isSecurityMandatory: boolean;
  message?: string;
  downloadUrl?: string;
}

export type VersionStatus = 'supported' | 'update_recommended' | 'update_required';

export interface VersionCheckResult {
  status: VersionStatus;
  currentVersion: string;
  minimumSupportedVersion: string;
  isSecurityMandatory: boolean;
  message: string;
  downloadUrl?: string;
}

export class VersionGuardService {
  public static readonly CURRENT_APP_VERSION = '1.0.0';

  /**
   * Compares two semantic version strings (A vs B).
   * Returns:
   *  -1 if vA < vB
   *   0 if vA === vB
   *   1 if vA > vB
   */
  public compareVersions(vA: string, vB: string): number {
    const parse = (v: string) => v.split('.').map((p) => parseInt(p, 10) || 0);
    const [majA, minA, patchA] = parse(vA);
    const [majB, minB, patchB] = parse(vB);

    if (majA !== majB) return majA > majB ? 1 : -1;
    if (minA !== minB) return minA > minB ? 1 : -1;
    if (patchA !== patchB) return patchA > patchB ? 1 : -1;
    return 0;
  }

  /**
   * Evaluates current version against a server policy.
   */
  public evaluateVersionPolicy(
    currentVersion: string,
    policy: VersionPolicy
  ): VersionCheckResult {
    const isBelowMinimum = this.compareVersions(currentVersion, policy.minimumSupportedVersion) < 0;
    const isBelowLatest = this.compareVersions(currentVersion, policy.latestVersion) < 0;

    if (isBelowMinimum && policy.isSecurityMandatory) {
      return {
        status: 'update_required',
        currentVersion,
        minimumSupportedVersion: policy.minimumSupportedVersion,
        isSecurityMandatory: true,
        message: policy.message || 'A critical security update is required to continue using KaryaDEX.',
        downloadUrl: policy.downloadUrl,
      };
    }

    if (isBelowMinimum || isBelowLatest) {
      return {
        status: 'update_recommended',
        currentVersion,
        minimumSupportedVersion: policy.minimumSupportedVersion,
        isSecurityMandatory: false,
        message: policy.message || 'A newer version of KaryaDEX is available.',
        downloadUrl: policy.downloadUrl,
      };
    }

    return {
      status: 'supported',
      currentVersion,
      minimumSupportedVersion: policy.minimumSupportedVersion,
      isSecurityMandatory: false,
      message: 'Application version is up to date and supported.',
      downloadUrl: policy.downloadUrl,
    };
  }

  /**
   * Validates version compatibility with default production policy.
   */
  public checkCompatibility(policyOverride?: VersionPolicy): VersionCheckResult {
    const defaultPolicy: VersionPolicy = {
      minimumSupportedVersion: '1.0.0',
      latestVersion: '1.0.0',
      isSecurityMandatory: false,
    };

    return this.evaluateVersionPolicy(
      VersionGuardService.CURRENT_APP_VERSION,
      policyOverride || defaultPolicy
    );
  }
}

export const versionGuardService = new VersionGuardService();
