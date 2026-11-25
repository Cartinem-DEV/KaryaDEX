package com.karyadex.lockin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.usage.UsageStatsManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class BlockingService : Service() {
    private var statsManager: UsageStatsManager? = null
    private val executor = Executors.newSingleThreadExecutor()
    private val usageStats = mutableMapOf<String, Long>()
    private var isListening = false
    private var pollingIntervalMs = 30000L

    private val realityCheckGraceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val packageName = intent.getStringExtra("package_name") ?: return
            val graceMinutes = intent.getIntExtra("grace_minutes", 5)
            startEmergencyPassGracePeriod(packageName, graceMinutes)
            Log.d("BlockingService", "Reality check continue: grace period for $packageName")
        }
    }

    override fun onCreate() {
        super.onCreate()
        val filter = IntentFilter("com.karyadex.lockin.ACTION_BLOCKED_PACKAGES_UPDATED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(blocklistUpdateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(blocklistUpdateReceiver, filter)
        }

        val realityFilter = IntentFilter("com.karyadex.lockin.ACTION_REALITY_CHECK_CONTINUE")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(realityCheckGraceReceiver, realityFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(realityCheckGraceReceiver, realityFilter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(blocklistUpdateReceiver)
        unregisterReceiver(realityCheckGraceReceiver)
    }

    private val blocklistUpdateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val updatedPackages = intent.getStringArrayListExtra("blocked_packages") ?: return
            sessionBlockedPackages = updatedPackages.toMutableSet()
            Log.d("BlockingService", "Blocklist updated mid-session: $sessionBlockedPackages")
        }
    }

    // Quota tracking (in-memory, synced from JS)
    private val quotas = mutableMapOf<String, Quota>()

    // Reality Check settings
    private var realityCheckEnabled = false
    private var realityCheckDelaySeconds = 10
    private var realityCheckPrompt = "Why are you opening this app?"

    // Active session state
    private var currentSessionId: String? = null
    private var sessionBlockedPackages = mutableSetOf<String>()
    private var sessionStrictMode = "none"

    fun startListening(context: Context) {
        this.statsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        isListening = true
        executor.submit { pollingLoop() }
    }

    fun stopListening() {
        isListening = false
    }

    // Called from LockinModule when session starts
    fun startSession(
        context: Context,
        sessionId: String,
        blockedPackages: List<String>,
        strictMode: String
    ) {
        currentSessionId = sessionId
        sessionBlockedPackages = blockedPackages.toMutableSet()
        sessionStrictMode = strictMode
        isListening = true
        executor.submit { pollingLoop() }
    }

    // Called from LockinModule when session ends
    fun endSession() {
        currentSessionId = null
        sessionBlockedPackages.clear()
        sessionStrictMode = "none"
    }

    // Update quotas from JS
    fun updateQuotas(newQuotas: List<Quota>) {
        quotas.clear()
        for (q in newQuotas) {
            quotas[q.packageName] = q
        }
    }

    // Update Reality Check settings
    fun updateRealityCheck(enabled: Boolean, delaySeconds: Int, prompt: String) {
        realityCheckEnabled = enabled
        realityCheckDelaySeconds = delaySeconds
        realityCheckPrompt = prompt
    }

    @Synchronized
    fun getTopForegroundPackage(): String? {
        return usageStats.entries.maxByOrNull { it.value }?.key
    }

    @Synchronized
    fun isPackageForeground(packageName: String): Boolean {
        return usageStats[packageName] ?: 0L > 0L
    }

    @Synchronized
    fun getUsageStats(): Map<String, Long> {
        return usageStats.toMap()
    }

    private fun pollingLoop() {
        while (isListening) {
            try {
                val statsManager = this.statsManager ?: break
                val now = System.currentTimeMillis()
                val past = now - pollingIntervalMs

                // Update usage stats for quota tracking
                val packages = quotas.keys.toList() + sessionBlockedPackages
                if (packages.isNotEmpty()) {
                    val pastStats = statsManager.queryUsageStats(
                        UsageStatsManager.INTERVAL_DAILY,
                        past,
                        now
                    )?.filter { it.packageName in packages } ?: emptyList()

                    synchronized(this) {
                        pastStats.forEach {
                            usageStats[it.packageName] = it.totalTimeInForeground
                        }
                    }
                }

                // Check for quota violations
                checkQuotaViolations(context!!)

                // Check for session blocking
                checkSessionBlocking(context!!)

            } catch (e: Exception) {
                Log.e("BlockingService", "Error in polling loop", e)
            }

            try {
                Thread.sleep(pollingIntervalMs)
            } catch (e: InterruptedException) {
                break
            }
        }
    }

    private fun checkQuotaViolations(context: Context) {
        for ((pkg, quota) in quotas) {
            if (!quota.isActive) continue
            val usedMs = usageStats[pkg] ?: 0L
            val usedMinutes = usedMs / (1000 * 60)
            if (usedMinutes >= quota.dailyLimitMinutes) {
                // Quota exceeded - trigger Reality Check or block
                Log.d("BlockingService", "Quota exceeded for $pkg: $usedMinutes/${quota.dailyLimitMinutes} min")
                triggerRealityCheck(context, pkg, "Daily limit reached ($usedMinutes/${quota.dailyLimitMinutes} min). $realityCheckPrompt")
            }
        }
    }

    private fun checkSessionBlocking(context: Context) {
        if (currentSessionId == null || sessionStrictMode == "none") return

        val topPackage = getTopForegroundPackage()
        topPackage?.let { pkg ->
            if (pkg in sessionBlockedPackages) {
                Log.d("BlockingService", "Blocked app $pkg launched during session")
                triggerRealityCheck(context, pkg, realityCheckPrompt)
            }
        }
    }

    private fun triggerRealityCheck(context: Context, packageName: String, prompt: String) {
        if (!realityCheckEnabled) {
            // If reality check disabled, just block outright in hard mode
            if (sessionStrictMode == "hard") {
                showBlockOverlay(context, packageName, "App blocked by Lockin")
            }
            return
        }

        val intent = Intent(context, RealityCheckActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            putExtra("package_name", packageName)
            putExtra("delay_seconds", realityCheckDelaySeconds)
            putExtra("prompt_question", prompt)
        }
        context.startActivity(intent)
    }

    private fun showBlockOverlay(context: Context, packageName: String, message: String) {
        // This would integrate with OverlayManager to show a blocking overlay
        Log.d("BlockingService", "Showing block overlay for $packageName: $message")
    }

    // Phase 5: Emergency pass grace timer
    private val graceTimer: MutableMap<String, Long> = mutableMapOf()
        // Maps packageName to expiry timestamp (millis)

    fun startEmergencyPassGracePeriod(packageName: String, graceMinutes: Int) {
        // Cancel any existing timer for this package
        cancelEmergencyPassGracePeriod(packageName)

        // Mark package as in grace period
        graceTimer[packageName] = System.currentTimeMillis() + (graceMinutes * 60 * 1000)

        // Notify JS layer that blocking is suspended for this package
        val intent = Intent("com.karyadex.lockin.EMERGENCY_PASS_STARTED")
        intent.putExtra("package_name", packageName)
        intent.putExtra("grace_minutes", graceMinutes)
        context.sendBroadcast(intent)

        // Schedule re-block after grace period
        val handler = Handler(Looper.getMainLooper())
        handler.postDelayed({
            cancelEmergencyPassGracePeriod(packageName)
            // Re-apply blocking for this package
            val blockedIntent = Intent("com.karyadex.lockin.RE_EMERGENCY_PASS_BLOCK")
            blockedIntent.putExtra("package_name", packageName)
            context.sendBroadcast(blockedIntent)
        }, graceMinutes * 60 * 1000L)
    }

    private fun cancelEmergencyPassGracePeriod(packageName: String) {
        graceTimer.remove(packageName)
        // Notify JS that grace period ended
        val intent = Intent("com.karyadex.lockin.EMERGENCY_PASS_ENDED")
        intent.putExtra("package_name", packageName)
        context.sendBroadcast(intent)
    }

    fun isInEmergencyPassGracePeriod(packageName: String): Boolean {
        return graceTimer[packageName]?.let { it > System.currentTimeMillis() } ?: false
    }

    data class Quota(
        val packageName: String,
        val dailyLimitMinutes: Int,
        val usedMinutesToday: Int,
        val isActive: Boolean
    )
}
