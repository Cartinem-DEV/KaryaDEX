package com.karyadex.lockin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver that fires at scheduled focus session start/end times.
 * Creates session records in DB and starts the BlockingService.
 */
class ScheduleAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val scheduleId = intent.getStringExtra("schedule_id") ?: return
        val strictMode = intent.getStringExtra("strict_mode") ?: "none"
        val blockedPackages = intent.getStringArrayListExtra("blocked_packages") ?: mutableListOf()
        val whitelistedYtChannels = intent.getStringArrayListExtra("whitelisted_yt_channels") ?: mutableListOf()
        val plannedDurationMinutes = intent.getIntExtra("planned_duration_minutes", 0)
        val action = intent.getAction() ?: "START"

        Log.d("LockinSchedule", "Alarm fired for schedule: $scheduleId, action: $action")

        if (action == "START") {
            // Generate session ID
            val sessionId = "sched_${scheduleId}_${System.currentTimeMillis()}"

            // TODO: Call JS bridge to create session record in SQLite
            // For now, we'll pass the session ID to BlockingService

            // Start the BlockingService
            val serviceIntent = Intent(context, BlockingService::class.java).apply {
                action = "START_FOCUS_SESSION"
                putExtra("session_id", sessionId)
                putExtra("schedule_id", scheduleId)
                putExtra("strict_mode", strictMode)
                putExtra("blocked_packages", blockedPackages)
                putExtra("whitelisted_yt_channels", whitelistedYtChannels)
                putExtra("planned_duration_minutes", plannedDurationMinutes)
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }

            // Notify JS layer to create session record
            notifyJsSessionCreated(scheduleId, sessionId, plannedDurationMinutes)
        } else if (action == "END") {
            val sessionId = intent.getStringExtra("session_id") ?: return

            // Notify JS layer to complete session record
            notifyJsSessionCompleted(sessionId, plannedDurationMinutes)
        }
    }

    private fun notifyJsSessionCreated(scheduleId: String, sessionId: String, plannedMinutes: Int) {
        // Send broadcast that JS layer can listen for via native module
        val broadcast = Intent("com.karyadex.lockin.SESSION_CREATED")
        broadcast.putExtra("schedule_id", scheduleId)
        broadcast.putExtra("session_id", sessionId)
        broadcast.putExtra("planned_minutes", plannedMinutes)
        broadcast.putExtra("user_id", LockinModule.getCurrentUserId())
        LockinModule.getInstance()?.let { it.context?.sendBroadcast(broadcast) }
    }

    private fun notifyJsSessionCompleted(sessionId: String, plannedMinutes: Int) {
        val broadcast = Intent("com.karyadex.lockin.SESSION_COMPLETED")
        broadcast.putExtra("session_id", sessionId)
        broadcast.putExtra("actual_minutes", plannedMinutes)
        LockinModule.getInstance()?.let { it.context?.sendBroadcast(broadcast) }
    }
}