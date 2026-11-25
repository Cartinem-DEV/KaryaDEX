package com.karyadex.lockin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class LockinReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            android.intent.action.BOOT_COMPLETED -> {
                // Check SharedPreferences for persisted session
                // If found, attempt resume via LockinModule
                // For now, we rely on the service being started manually or via explicit intent
            }
            LockinService.ACTION_PAUSE -> {
                LockinModule.onPauseAction(context)
            }
            LockinService.ACTION_ABANDON -> {
                LockinModule.onAbandonAction(context)
            }
        }
    }
}