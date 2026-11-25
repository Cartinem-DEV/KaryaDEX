package com.karyadex.lockin

import android.content.Context
import android.app.usage.UsageStatsManager
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar

/**
 * Background worker that periodically checks app usage against daily quotas
 * and triggers blocking when limits are exceeded.
 */
class QuotaMonitorWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    private val statsManager: UsageStatsManager =
        applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    override fun doWork(): Result {
        try {
            // Check and reset quotas at midnight
            resetQuotasIfNewDay()

            // Get current quotas from shared preferences / storage
            val quotas = getQuotas()
            if (quotas.isEmpty()) {
                return Result.success()
            }

            // Query current day usage
            val now = System.currentTimeMillis()
            val startOfDay = getStartOfDayMillis()

            val usageStats = statsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startOfDay,
                now
            ) ?: emptyList()

            // Check each quota
            for (usage in usageStats) {
                val quota = quotas[usage.packageName]
                if (quota != null && quota.isActive) {
                    val usedMinutes = usage.totalTimeInForeground / (1000 * 60)
                    if (usedMinutes >= quota.dailyLimitMinutes) {
                        // Trigger blocking for this app
                        triggerQuotaBlock(usage.packageName, usedMinutes.toInt(), quota.dailyLimitMinutes)
                    }
                }
            }

            return Result.success()
        } catch (e: Exception) {
            Log.e("QuotaMonitorWorker", "Error checking quotas", e)
            return Result.retry()
        }
    }

    private fun resetQuotasIfNewDay() {
        val prefs = applicationContext.getSharedPreferences("lockin_quotas", Context.MODE_PRIVATE)
        val lastReset = prefs.getString("last_reset_date", "")
        val today = Calendar.getInstance().let { String.format("%04d-%02d-%02d", it.get(Calendar.YEAR), it.get(Calendar.MONTH) + 1, it.get(Calendar.DAY_OF_MONTH)) }

        if (lastReset != today) {
            val editor = prefs.edit()
            editor.putString("last_reset_date", today)
            // Reset used_minutes_today for all quotas
            // In practice, we'd update the DB or native storage
            editor.apply()
        }
    }

    private fun getQuotas(): Map<String, Quota> {
        // In production, this would read from a database or shared preferences
        // For now, return empty - will be populated from JS bridge
        return emptyMap()
    }

    private fun triggerQuotaBlock(packageName: String, usedMinutes: Int, limitMinutes: Int) {
        Log.d("QuotaMonitorWorker", "Quota exceeded for $packageName: $usedMinutes/$limitMinutes minutes")
        // Send broadcast to BlockingService to show overlay
        val intent = Intent("com.karyadex.lockin.QUOTA_EXCEEDED")
        intent.putExtra("package_name", packageName)
        intent.putExtra("used_minutes", usedMinutes)
        intent.putExtra("limit_minutes", limitMinutes)
        applicationContext.sendBroadcast(intent)
    }

    private fun getStartOfDayMillis(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    data class Quota(
        val packageName: String,
        val dailyLimitMinutes: Int,
        val isActive: Boolean
    )
}