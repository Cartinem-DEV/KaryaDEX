import ExpoModulesCore
import FamilyControls
import ManagedSettings

public class LockinModule: Module {
    private let store = ManagedSettingsStore()
    private var isAuthorized = false

    public func definition() -> ModuleDefinition {
        Name("LockinModule")

        // Events
        Events("onSessionTick", "onSessionComplete", "onBlockingEvent",
               "onStrictModeTriggered", "onError")

        // Session Management
        AsyncFunction("startSession") { (params: [String: Any]) -> Void in
            print("LockinModule: startSession called (iOS no-op for timer)")
        }

        AsyncFunction("pauseSession") { () -> Void in
            print("LockinModule: pauseSession called (iOS no-op)")
        }

        AsyncFunction("resumeSession") { () -> Void in
            print("LockinModule: resumeSession called (iOS no-op)")
        }

        AsyncFunction("endSession") { () -> Void in
            print("LockinModule: endSession called (iOS no-op)")
        }

        AsyncFunction("getSessionState") { () -> [String: Any] in
            return ["remainingSeconds": 0, "isActive": false]
        }

        // Blocking
        AsyncFunction("addBlockedPackages") { (packages: [String]) -> Void in
            print("LockinModule: addBlockedPackages called (iOS no-op)")
        }
        AsyncFunction("removeBlockedPackages") { (packages: [String]) -> Void in
            print("LockinModule: removeBlockedPackages called (iOS no-op)")
        }
        AsyncFunction("getBlockedPackages") { () -> [String] in
            return []
        }

        // YouTube
        AsyncFunction("parseYoutubeUrl") { (url: String) -> [String: Any] in
            print("LockinModule: parseYoutubeUrl called (iOS no-op)")
            return ["channelId": NSNull(), "channelName": NSNull(), "isValid": false]
        }
        AsyncFunction("addWhitelistedChannel") { (channelId: String) -> Void in
            print("LockinModule: addWhitelistedChannel called (iOS no-op)")
        }
        AsyncFunction("removeWhitelistedChannel") { (channelId: String) -> Void in
            print("LockinModule: removeWhitelistedChannel called (iOS no-op)")
        }

        // Strict Mode
        AsyncFunction("setStrictMode") { (mode: String) -> Void in
            print("LockinModule: setStrictMode called (iOS no-op)")
        }
        AsyncFunction("getStrictMode") { () -> [String: Any] in
            return ["mode": "none"]
        }

        // Permissions
        AsyncFunction("requestOverlayPermission") { () -> Bool in
            print("LockinModule: requestOverlayPermission called (iOS no-op)")
            return true
        }
        AsyncFunction("requestUsageStatsPermission") { () -> Bool in
            print("LockinModule: requestUsageStatsPermission called (iOS no-op)")
            return true
        }
        AsyncFunction("requestNotificationPermission") { () -> Bool in
            print("LockinModule: requestNotificationPermission called (iOS no-op)")
            return true
        }
        AsyncFunction("hasAllPermissions") { () -> Bool in
            print("LockinModule: hasAllPermissions called (iOS no-op)")
            return true
        }

        // ─── Phase 4: iOS Screen Time & Managed Settings ──────────────

        AsyncFunction("requestScreenTimePermission") { () async -> Bool in
            if #available(iOS 16.0, *) {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    self.isAuthorized = true
                    print("LockinModule: Screen Time authorization granted")
                    return true
                } catch {
                    print("LockinModule: Screen Time authorization failed: \(error.localizedDescription)")
                    return false
                }
            } else {
                print("LockinModule: Screen Time API requires iOS 16.0+")
                return false
            }
        }

        AsyncFunction("startBlockingSession") { (params: [String: Any]) -> Void in
            guard #available(iOS 16.0, *) else {
                print("LockinModule: startBlockingSession requires iOS 16.0+")
                return
            }
            guard self.isAuthorized else {
                print("LockinModule: startBlockingSession called without Screen Time authorization")
                return
            }

            let blockedPackages = params["blockedPackages"] as? [String] ?? []
            let bundleIdentifiers = Set(blockedPackages.map { ApplicationToken(bundleIdentifier: $0) })

            self.store.shield.applications = bundleIdentifiers
            print("LockinModule: Shielded \(bundleIdentifiers.count) applications")
        }

        AsyncFunction("endBlockingSession") { () -> Void in
            guard #available(iOS 16.0, *) else {
                print("LockinModule: endBlockingSession requires iOS 16.0+")
                return
            }

            self.store.shield.applications = nil
            print("LockinModule: Removed all application shields")
        }

        AsyncFunction("isScreenTimeAuthorized") { () -> Bool in
            return self.isAuthorized
        }

        // ─── Phase 5: iOS No-Op Stubs for Phase 3 Methods ──────────────

        AsyncFunction("scheduleSchedules") { (schedules: [[String: Any]]) -> Void in
            print("LockinModule: scheduleSchedules called (iOS no-op)")
        }

        AsyncFunction("cancelSchedule") { (scheduleId: String) -> Void in
            print("LockinModule: cancelSchedule called (iOS no-op)")
        }

        AsyncFunction("launchRealityCheck") { (params: [String: Any]) -> Void in
            print("LockinModule: launchRealityCheck called (iOS no-op)")
        }

        AsyncFunction("updateQuotas") { (quotas: [[String: Any]]) -> Void in
            print("LockinModule: updateQuotas called (iOS no-op)")
        }

        AsyncFunction("updateRealityCheck") { (enabled: Bool, delaySeconds: Int, prompt: String) -> Void in
            print("LockinModule: updateRealityCheck called (iOS no-op)")
        }

        AsyncFunction("updateBlockedPackages") { (packages: [String]) -> Void in
            print("LockinModule: updateBlockedPackages called (iOS no-op)")
        }

        AsyncFunction("createScheduledSession") { (scheduleId: String, userId: String) -> Void in
            print("LockinModule: createScheduledSession called (iOS no-op)")
        }

        AsyncFunction("completeScheduledSession") { (sessionId: String, actualMinutes: Int) -> Void in
            print("LockinModule: completeScheduledSession called (iOS no-op)")
        }

        AsyncFunction("startEmergencyPassGracePeriod") { (packageName: String, graceMinutes: Int) -> Void in
            print("LockinModule: startEmergencyPassGracePeriod called (iOS no-op)")
        }

        AsyncFunction("cancelEmergencyPassGracePeriod") { (packageName: String) -> Void in
            print("LockinModule: cancelEmergencyPassGracePeriod called (iOS no-op)")
        }

        AsyncFunction("isInEmergencyPassGracePeriod") { (packageName: String) -> Bool in
            return false
        }
    }
}

</content>