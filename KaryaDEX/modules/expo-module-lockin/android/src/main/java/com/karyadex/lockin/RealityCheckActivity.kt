package com.karyadex.lockin

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Reality Check Overlay Activity - Shows a breathing countdown and intent prompt
 * before allowing access to a restricted/distracting app.
 */
class RealityCheckActivity : AppCompatActivity() {

    private var countdownSeconds: Int = 10
    private var promptQuestion: String = "Why are you opening this app?"
    private var packageName: String = ""
    private var intentReason: String = ""

    private lateinit var countdownText: TextView
    private lateinit var promptText: TextView
    private lateinit var intentInput: EditText
    private lateinit var continueButton: Button
    private lateinit var closeAppButton: Button
    private lateinit var progressRing: ProgressBar

    private var countdownTimer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reality_check)

        // Get extras from intent
        countdownSeconds = intent.getIntExtra("delay_seconds", 10)
        promptQuestion = intent.getStringExtra("prompt_question") ?: "Why are you opening this app?"
        packageName = intent.getStringExtra("package_name") ?: ""

        // Initialize views
        countdownText = findViewById(R.id.countdown_text)
        promptText = findViewById(R.id.prompt_text)
        intentInput = findViewById(R.id.intent_input)
        continueButton = findViewById(R.id.continue_button)
        closeAppButton = findViewById(R.id.close_app_button)
        progressRing = findViewById(R.id.progress_ring)

        promptText.text = promptQuestion

        // Initially disable continue button
        continueButton.isEnabled = false
        continueButton.alpha = 0.5f

        // Setup buttons
        continueButton.setOnClickListener {
            intentReason = intentInput.text.toString()
            // Grant 5-minute grace period with auto-reblock
            val context = applicationContext
            val graceIntent = Intent("com.karyadex.lockin.ACTION_REALITY_CHECK_CONTINUE").apply {
                putExtra("package_name", packageName)
                putExtra("grace_minutes", 5)
            }
            context.sendBroadcast(graceIntent)
            finishWithResult(Activity.RESULT_OK)
        }

        closeAppButton.setOnClickListener {
            finishWithResult(Activity.RESULT_CANCELED)
        }

        // Start countdown
        startCountdown()
    }

    private fun startCountdown() {
        val totalMs = countdownSeconds.toLong() * 1000
        progressRing.max = countdownSeconds

        countdownTimer = object : CountDownTimer(totalMs, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val remaining = (millisUntilFinished / 1000).toInt() + 1
                countdownText.text = remaining.toString()
                progressRing.progress = countdownSeconds - remaining + 1
            }

            override fun onFinish() {
                countdownText.text = "0"
                progressRing.progress = countdownSeconds
                continueButton.isEnabled = true
                continueButton.alpha = 1f
                continueButton.text = "Continue to App"
            }
        }.start()
    }

    private fun finishWithResult(resultCode: Int) {
        countdownTimer?.cancel()
        val resultIntent = Intent().apply {
            putExtra("package_name", packageName)
            putExtra("intent_reason", intentReason)
            putExtra("result_code", resultCode)
        }
        setResult(resultCode, resultIntent)
        finish()
    }

    override fun onDestroy() {
        countdownTimer?.cancel()
        super.onDestroy()
    }

    override fun onBackPressed() {
        // Disable back button during countdown to enforce the pause
        if (countdownTimer != null && continueButton.isEnabled) {
            finishWithResult(Activity.RESULT_CANCELED)
        }
    }
}