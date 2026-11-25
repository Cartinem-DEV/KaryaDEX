package com.karyadex.lockin

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Periodic worker that resets emergency pass weekly allowance.
 * Runs every Monday at 00:00.
 */
class EmergencyPassResetWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        try {
            resetWeeklyPassAllowance()
            return Result.success()
        } catch (e: Exception) {
            Log.e("EmergencyPassResetWorker", "Error resetting weekly passes", e)
            return Result.retry()
        }
    }

    private fun resetWeeklyPassAllowance() {
        val prefs = applicationContext.getSharedPreferences("lockin_emergency_passes", Context.MODE_PRIVATE)
        val editor = prefs.edit()

        // Get current week in YYYY-WW format
        val cal = Calendar.getInstance()
        val weekOfYear = cal.get(Calendar.WEEK_OF_YEAR)
        val year = cal.get(Calendar.YEAR)
        val currentWeek = String.format("%04d-%02d", year, weekOfYear)

        val lastResetWeek = prefs.getString("last_reset_week", "")

        // Only reset if we haven't already reset this week
        if (lastResetWeek != currentWeek) {
            editor.putString("last_reset_week", currentWeek)
            editor.putInt("used_this_week", 0)
            editor.apply()
            Log.d("EmergencyPassResetWorker", "Weekly pass allowance reset for week: $currentWeek")
        } else {
            Log.d("EmergencyPassResetWorker", "Weekly pass already reset for week: $currentWeek")
        }
    }

    companion object {
        private const val WORK_NAME = "emergency_pass_reset"

        fun enqueue(context: Context) {
            val workRequest = PeriodicWorkRequestBuilder<EmergencyPassResetWorker>()
                .setInitialDelay(1, TimeUnit.MINUTES) // Initial delay for testing
                .setInterval(7, TimeUnit.DAYS) // Weekly
                .setFlexInterval(6, TimeUnit.DAYS) // Flex window to allow Monday 00:00
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        }
    }
}