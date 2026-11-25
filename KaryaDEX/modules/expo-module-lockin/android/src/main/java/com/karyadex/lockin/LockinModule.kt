package com.karyadex.lockin

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.Event
import expo.modules.kotlin.modules.EventDispatcher
import expo.modules.core.Notifications
import expo.modules.core.Permissions
import expo.modules.core.Platform
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import android.Manifest
import android.content.pm.PackageManager
import android.provider.Settings
import java.util.*
import android.net.Uri
import android.app.AppOpsManager
import android.view.WindowManager

class LockinModule : Module() {

  // Event dispatcher
  private val dispatcher: EventDispatcher = events {
    // Map native events to JS callbacks
  }

  // Session state
  private var sessionRemainingSeconds = 0
  private var sessionIsActive = false
  private var strictMode: String = "none"
  private val blockedPackages = mutableSetOf<String>()
  private val whitelistedYtChannels = mutableSetOf<String>()

  // Task 4: App Usage Monitoring, Overlay Blocker & YouTube Parser
  private val blockingService = BlockingService()
  private val youtubeParser = YoutubeUrlParser()
  private var overlayManager: OverlayManager? = null
  private var autoBlockEnabled = false
  private lateinit var windowManager: WindowManager

  // Shared session state - accessible from Service and Receiver
  companion object {
    var sessionId: String? = null
    var sessionRemainingSeconds = 0
    var sessionTotalDuration = 0
    var sessionIsActive = false
    var strictMode: String = "none"
    val blockedPackages = mutableSetOf<String>()
    val whitelistedYtChannels = mutableSetOf<String>()

    var dispatcher: EventDispatcher? = null

    fun startForegroundService(context: Context, sessionId: String, totalDuration: Int, remainingSeconds: Int = totalDuration) {
      LockinModule.sessionId = sessionId
      LockinModule.sessionTotalDuration = totalDuration
      LockinModule.sessionRemainingSeconds = remainingSeconds
      LockinModule.sessionIsActive = true

      val intent = Intent(context, LockinService::class.java).apply {
        putExtra("sessionId", sessionId)
        putExtra("totalDuration", totalDuration)
        putExtra("remainingSeconds", remainingSeconds)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stopForegroundService(context: Context) {
      val intent = Intent(context, LockinService::class.java)
      context.stopService(intent)
      sessionIsActive = false
    }

    fun onPauseAction(context: Context) {
      sessionIsActive = false
      stopForegroundService(context)
      dispatcher?.onSessionTick(sessionRemainingSeconds)
    }

    fun onAbandonAction(context: Context) {
      sessionIsActive = false
      sessionRemainingSeconds = 0
      sessionId = null
      stopForegroundService(context)
      dispatcher?.onSessionComplete(sessionId ?: "")
    }

    fun getSessionState(): Map<String, Any?> {
      return mapOf(
        "sessionId" to sessionId,
        "remainingSeconds" to sessionRemainingSeconds,
        "totalDuration" to sessionTotalDuration,
        "isActive" to sessionIsActive,
        "strictMode" to strictMode
      )
    }
  }

  // --- Session Management ---

  @ReactMethod
  fun startSession(
    sessionId: String,
    plannedDurationMinutes: Int,
    blockedPackages: List<String>,
    whitelistedYtChannels: List<String>,
    strictMode: String
  ) {
    this.sessionRemainingSeconds = plannedDurationMinutes * 60
    this.sessionIsActive = true
    this.strictMode = strictMode
    this.blockedPackages.addAll(blockedPackages.toSet())
    this.whitelistedYtChannels.addAll(whitelistedYtChannels.toSet())

    // Sync to companion object
    LockinModule.sessionId = sessionId
    LockinModule.sessionRemainingSeconds = this.sessionRemainingSeconds
    LockinModule.sessionTotalDuration = this.sessionRemainingSeconds
    LockinModule.sessionIsActive = true
    LockinModule.strictMode = strictMode
    LockinModule.blockedPackages.addAll(blockedPackages.toSet())
    LockinModule.whitelistedYtChannels.addAll(whitelistedYtChannels.toSet())

    // Store dispatcher reference
    LockinModule.dispatcher = dispatcher

    // Start foreground service
    val context = appContext.reactContext ?: return
    startForegroundService(context, sessionId, plannedDurationMinutes * 60)

    // Dispatch event
    dispatcher.onSessionTick(sessionRemainingSeconds)
  }

  @ReactMethod
  fun pauseSession() {
    sessionIsActive = false
    LockinModule.sessionIsActive = false
    val context = appContext.reactContext ?: return
    stopForegroundService(context)
    dispatcher.onSessionTick(sessionRemainingSeconds)
  }

  @ReactMethod
  fun resumeSession() {
    sessionIsActive = true
    LockinModule.sessionIsActive = true
    val context = appContext.reactContext ?: return
    if (LockinModule.sessionId != null) {
      startForegroundService(context, LockinModule.sessionId!!, LockinModule.sessionTotalDuration, LockinModule.sessionRemainingSeconds)
    }
    dispatcher.onSessionTick(sessionRemainingSeconds)
  }

  @ReactMethod
  fun endSession() {
    sessionIsActive = false
    sessionRemainingSeconds = 0
    strictMode = "none"
    blockedPackages.clear()
    whitelistedYtChannels.clear()

    LockinModule.sessionIsActive = false
    LockinModule.sessionRemainingSeconds = 0
    LockinModule.sessionId = null

    val context = appContext.reactContext ?: return
    stopForegroundService(context)
    dispatcher.onSessionTick(0)
  }

  @ReactMethod
  fun getSessionState(): Map<String, Any?> {
    return mapOf(
      "remainingSeconds" to sessionRemainingSeconds,
      "isActive" to sessionIsActive
    )
  }

  // --- Blocking ---

  @ReactMethod
  fun addBlockedPackages(packages: List<String>) {
    blockedPackages.addAll(packages.toSet())
    LockinModule.blockedPackages.addAll(packages.toSet())
  }

  @ReactMethod
  fun removeBlockedPackages(packages: List<String>) {
    blockedPackages.removeAll(packages)
    LockinModule.blockedPackages.removeAll(packages)
  }

  @ReactMethod
  fun getBlockedPackages(): List<String> {
    return blockedPackages.toList()
  }

  @ReactMethod
  fun addBlockedPackagesAuto() {
    val topPackage = blockingService.getTopForegroundPackage()
    if (topPackage != null) {
      addBlockedPackages(listOf(topPackage))
    }
  }

  @ReactMethod
  fun setBlockedPackageAutomatic(enabled: Boolean) {
    autoBlockEnabled = enabled
    if (enabled) {
      blockingService.startListening(appContext.reactContext!!)
    } else {
      blockingService.stopListening()
    }
  }

  @ReactMethod
  fun getTopForegroundPackage(): String? {
    return blockingService.getTopForegroundPackage()
  }

  @ReactMethod
  fun isPackageForeground(packageName: String): Boolean {
    return blockingService.isPackageForeground(packageName)
  }

  // --- YouTube ---

  @ReactMethod
  fun parseYoutubeUrl(url: String): Map<String, Any?> {
    val result = youtubeParser.parse(url)
    return mapOf(
      "channelId" to result.channelId,
      "channelName" to result.channelName,
      "isValid" to result.isValid
    )
  }

  @ReactMethod
  fun addWhitelistedChannel(channelId: String) {
    whitelistedYtChannels.add(channelId)
    LockinModule.whitelistedYtChannels.add(channelId)
  }

  @ReactMethod
  fun removeWhitelistedChannel(channelId: String) {
    whitelistedYtChannels.remove(channelId)
    LockinModule.whitelistedYtChannels.remove(channelId)
  }

  // --- Strict Mode ---

  @ReactMethod
  fun setStrictMode(mode: String) {
    this.strictMode = mode
    LockinModule.strictMode = mode
    when (mode) {
      "soft" -> {
        overlayManager?.showOverlay()
        dispatcher.onStrictModeTriggered("soft")
      }
      "hard" -> {
        overlayManager?.hideOverlay()
        dispatcher.onStrictModeTriggered("hard")
      }
      else -> overlayManager?.hideOverlay()
    }
  }

  @ReactMethod
  fun getStrictMode(): Map<String, Any?> {
    return mapOf("mode" to strictMode)
  }

  // --- Permissions ---

  @ReactMethod
  fun requestOverlayPermission(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val context = appContext.reactContext ?: return false
      if (!Settings.canDrawOverlays(context)) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + context.packageName))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return false
      }
      return true
    }
    return true
  }

  @ReactMethod
  fun requestUsageStatsPermission(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      val context = appContext.reactContext ?: return false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
      if (mode != AppOpsManager.MODE_ALLOWED) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return false
      }
      return true
    }
    return true
  }

  @ReactMethod
  fun requestNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val context = appContext.reactContext ?: return false
      if (ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return false
      }
      return true
    }
    return true
  }

  @ReactMethod
  fun hasAllPermissions(): Boolean {
    return requestOverlayPermission() &&
           requestUsageStatsPermission() &&
           requestNotificationPermission()
  }

  // --- Native module lifecycle ---

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    overlayManager = OverlayManager(this, windowManager)
    // Initialize notification channels, receivers, etc.
    EmergencyPassResetWorker.enqueue(appContext.reactContext)
  }

  override fun onStart() {
    super.onStart()
    // Register receivers, start polling
  }

  override fun onStop() {
    super.onStop()
    // Unregister receivers, stop polling
    overlayManager?.hideOverlay()
  }

  // --- Phase 3: Scheduled Focus Engine ---

  @ReactMethod
  fun scheduleSchedules(schedules: List<Map<String, Any>>) {
    val context = appContext.reactContext ?: return
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    for (s in schedules) {
      val scheduleId = s["scheduleId"] as String? ?: continue
      val startTime = s["startTime"] as String? ?: continue // "HH:mm"
      val endTime = s["endTime"] as String? ?: continue
      val daysOfWeek = (s["daysOfWeek"] as List<Int>?) ?: mutableListOf()
      val strictMode = s["strictMode"] as String? ?: "none"

      // For each day, set a recurring alarm
      for (day in daysOfWeek) {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_WEEK, day)
        val (hour, minute) = startTime.split(":").map { it.toInt() }
        calendar.set(Calendar.HOUR_OF_DAY, hour)
        calendar.set(Calendar.MINUTE, minute)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)

        // If the time has already passed this week, schedule for next week
        if (calendar.timeInMillis < System.currentTimeMillis()) {
          calendar.add(Calendar.WEEK_OF_YEAR, 1)
        }

        val intent = Intent(context, ScheduleAlarmReceiver::class.java).apply {
          putExtra("schedule_id", scheduleId)
          putExtra("strict_mode", strictMode)
          // Add blocked packages and whitelisted channels
          putStringArrayListExtra("blocked_packages", blockedPackages.toArrayList())
          putStringArrayListExtra("whitelisted_yt_channels", whitelistedYtChannels.toArrayList())
          putExtra("planned_duration_minutes", endTime.split(":").map { it.toInt() }.let { (h, m) -> h * 60 + m } - hour * 60 - minute)
        }

        val pendingIntent = PendingIntent.getBroadcast(
          context,
          scheduleId.hashCode() * 31 + day,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            pendingIntent
          )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pendingIntent)
        } else {
          alarmManager.set(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pendingIntent)
        }
      }
    }
  }

  @ReactMethod
  fun cancelSchedule(scheduleId: String) {
    val context = appContext.reactContext ?: return
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    // Cancel for all 7 days
    for (day in 1..7) {
      val intent = Intent(context, ScheduleAlarmReceiver::class.java)
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        scheduleId.hashCode() * 31 + day,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      alarmManager.cancel(pendingIntent)
    }
  }

  // --- Reality Check Launch Helper ---

  @ReactMethod
  fun launchRealityCheck(
    packageName: String,
    delaySeconds: Int,
    promptQuestion: String
  ) {
    val context = appContext.reactContext ?: return
    val intent = Intent(context, RealityCheckActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
      putExtra("package_name", packageName)
      putExtra("delay_seconds", delaySeconds)
      putExtra("prompt_question", promptQuestion)
    }
    context.startActivity(intent)
  }

  // --- Phase 3: Quota & Reality Check Configuration ---

  @ReactMethod
  fun updateQuotas(quotas: List<Map<String, Any>>) {
    val quotaList = mutableListOf<BlockingService.Quota>()
    for (q in quotas) {
      val pkg = q["packageName"] as String? ?: continue
      val limit = q["dailyLimitMinutes"] as Int? ?: 0
      val used = q["usedMinutesToday"] as Int? ?: 0
      val active = q["isActive"] as Boolean? ?: false
      quotaList.add(BlockingService.Quota(pkg, limit, used, active))
    }
    blockingService.updateQuotas(quotaList)
  }

  @ReactMethod
  fun updateRealityCheck(enabled: Boolean, delaySeconds: Int, prompt: String) {
    blockingService.updateRealityCheck(enabled, delaySeconds, prompt)
  }

  @ReactMethod
  fun startBlockingSession(
    sessionId: String,
    blockedPackages: List<String>,
    strictMode: String
  ) {
    val context = appContext.reactContext ?: return
    blockingService.startSession(context, sessionId, blockedPackages, strictMode)
  }

  @ReactMethod
  fun endBlockingSession() {
    blockingService.endSession()
  }

  // Phase 5: Quota persistence from native worker
  @ReactMethod
  fun updateQuotaUsedMinutes(packageName: String, usedMinutes: Int) {
    updateQuotaUsedMinutesInternal(packageName, usedMinutes)
  }

  private fun updateQuotaUsedMinutesInternal(packageName: String, usedMinutes: Int) {
    Thread {
      Log.d("LockinModule", "updateQuotaUsedMinutes: $packageName = $usedMinutes min")
    }.start()
  }

  @ReactMethod
  fun updateBlockedPackages(packages: List<String>) {
    LockinModule.blockedPackages.clear()
    LockinModule.blockedPackages.addAll(packages)

    // Broadcast to BlockingService for mid-session sync
    val context = appContext.reactContext ?: return
    val intent = android.content.Intent("com.karyadex.lockin.ACTION_BLOCKED_PACKAGES_UPDATED").apply {
        putStringArrayListExtra("blocked_packages", ArrayList(packages))
    }
    context.sendBroadcast(intent)
  }

  // Phase 5: Scheduled session lifecycle from native
  @ReactMethod
  fun createScheduledSession(scheduleId: String, userId: String) {
    Log.d("LockinModule", "createScheduledSession: scheduleId=$scheduleId, userId=$userId")
    // This would call into JS/storage to create the session record
    // For now, log and the JS bridge will handle it
  }

  @ReactMethod
  fun completeScheduledSession(sessionId: String, actualMinutes: Int) {
    Log.d("LockinModule", "completeScheduledSession: sessionId=$sessionId, actualMinutes=$actualMinutes")
    // This would call into JS/storage to complete the session record
  }

  // Phase 5: Emergency pass grace period
  @ReactMethod
  fun startEmergencyPassGracePeriod(packageName: String, graceMinutes: Int) {
    blockingService.startEmergencyPassGracePeriod(packageName, graceMinutes)
  }

  @ReactMethod
  fun cancelEmergencyPassGracePeriod(packageName: String) {
    blockingService.cancelEmergencyPassGracePeriod(packageName)
  }

  @ReactMethod
  fun isInEmergencyPassGracePeriod(packageName: String): Boolean {
    return blockingService.isInEmergencyPassGracePeriod(packageName)
  }
}