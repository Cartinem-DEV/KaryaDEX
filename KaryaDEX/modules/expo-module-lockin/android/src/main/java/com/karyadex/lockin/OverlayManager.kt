package com.karyadex.lockin

import android.content.Context
import android.graphics.PixelFormat
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import android.graphics.Color
import android.view.Gravity

class OverlayManager(context: Context, windowManager: WindowManager) {
    private val context: Context = context
    private val windowManager: WindowManager = windowManager
    private val view: View
    private var params: WindowManager.LayoutParams? = null
    private var isShowing = false

    init {
        view = TextView(context).apply {
            text = "LOCKIN"
            setBackgroundColor(Color.parseColor("#00000000"))
            setTextColor(Color.WHITE)
            textSize = 48f
            gravity = Gravity.CENTER
        }
    }

    fun showOverlay() {
        if (isShowing) return

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
                or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }

        try {
            windowManager.addView(view, params)
            isShowing = true
        } catch (e: Exception) {
            // Handle permission error or window already added
            isShowing = false
        }
    }

    fun hideOverlay() {
        if (isShowing) {
            try {
                windowManager.removeView(view)
                isShowing = false
            } catch (e: Exception) {
                // View not attached or already removed
                isShowing = false
            }
        }
    }

    fun isShowing(): Boolean = isShowing
}
