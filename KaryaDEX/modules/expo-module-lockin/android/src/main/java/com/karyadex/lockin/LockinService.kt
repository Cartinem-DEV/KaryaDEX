package com.karyadex.lockin

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import java.util.Timer
import java.util.TimerTask

class LockinService : Service() {
    private var timer: Timer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val NOTIFICATION_ID = 1001
    private val CHANNEL_ID = "lockin_timer"
    private var remainingSeconds = 0
    private var totalDuration = 0
    private var currentSessionId: String? = null

    companion object {
        const val ACTION_PAUSE = "com.karyadex.lockin.ACTION_PAUSE"
        const val ACTION_ABANDON = "com.karyadex.lockin.ACTION_ABANDON"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null) {
            remainingSeconds = intent.getIntExtra("remainingSeconds", 0)
            totalDuration = intent.getIntExtra("totalDuration", 0)
            currentSessionId = intent.getStringExtra("sessionId")
            startForeground(NOTIFICATION_ID, buildNotification())
            startCountdown()
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Lockin Timer",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Ongoing focus timer" }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LockinService::wakeLock")
        wakeLock?.acquire()
    }

    private fun startCountdown() {
        timer = Timer()
        timer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                if (remainingSeconds > 0) {
                    remainingSeconds--
                    // Update LockinModule shared state
                    LockinModule.sessionRemainingSeconds = remainingSeconds
                    // Update notification
                    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    nm.notify(NOTIFICATION_ID, buildNotification())
                    // Dispatch tick event
                    LockinModule.dispatcher?.onSessionTick(remainingSeconds)
                } else {
                    // Timer complete
                    LockinModule.dispatcher?.onSessionComplete(currentSessionId ?: "")
                    stopSelf()
                }
            }
        }, 1000, 1000)
    }

    private fun buildNotification(): Notification {
        val pauseIntent = Intent(this, LockinReceiver::class.java).apply {
            action = ACTION_PAUSE
        }
        val abandonIntent = Intent(this, LockinReceiver::class.java).apply {
            action = ACTION_ABANDON
        }

        val pausePendingIntent = PendingIntent.getBroadcast(
            this, 0, pauseIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val abandonPendingIntent = PendingIntent.getBroadcast(
            this, 1, abandonIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("LOCKIN Focus Session")
            .setContentText(formatTime(remainingSeconds))
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setProgress(totalDuration, totalDuration - remainingSeconds, false)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Abandon", abandonPendingIntent)
            .build()
    }

    private fun formatTime(seconds: Int): String {
        val mins = seconds / 60
        val secs = seconds % 60
        return String.format("%02d:%02d", mins, secs)
    }

    override fun onDestroy() {
        super.onDestroy()
        timer?.cancel()
        timer = null
        wakeLock?.release()
        wakeLock = null
        stopForeground(true)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}