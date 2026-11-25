# AI Provider Limits & Quota Architecture (Phase 12)

## 1. Overview & Non-Assumptions Policy
KaryaDEX treats AI provider quotas and rate limits as **runtime/account-configurable parameters** rather than fixed perpetual truths. The system makes zero hardcoded assumptions regarding "guaranteed DAU", "unlimited free requests", or permanent token limits.

Both production AI personas—**Banku** (Google Gemini) and **Shanky** (Mistral AI)—run on **strictly independent quota pools**. Exhaustion or rate limiting of Google Gemini NEVER disables Shanky, and transient failures in Mistral NEVER degrade Banku or silently route conversational traffic to Google.

---

## 2. Active Production Model Configuration & Slots

| Slot | Persona | Provider | Model ID | Primary Role | Fallback Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Slot 1** | **Banku** | Google | `gemini-3.8-flash` | Multimodal OCR, PDF timetable parsing, routines | `gemini-3.7-flash` |
| **Slot 2** | **Banku** | Google | `gemini-3.7-flash` | Heavy lifting fallback on retryable 429/503 | None |
| **Slot 3** | **Shanky** | Mistral | `ministral-8b-2512` | Instant chat, daily briefings, attendance explanations | None (Independent pool) |

> **Critical Isolation Rule**: If Mistral (`ministral-8b-2512`) returns HTTP 429 or becomes unavailable, the system renders a graceful *"Shanky is temporarily unavailable"* state and falls back to local deterministic templates. Traffic is **never** silently redirected to Google Gemini.

---

## 3. Centralized Provider Limits (`AI_PROVIDER_LIMITS`)

All limits are centralized under `services/ai/providers/providerConfig.ts`:

```typescript
export const AI_PROVIDER_LIMITS: Record<'gemini' | 'mistral', AIProviderLimitConfig> = {
  gemini: {
    provider: 'gemini',
    requestsPerMinute: 15,
    tokensPerMinute: 1000000,
    dailyRequestCeiling: 1500,
    monthlyTokenBudget: 50000000,
    retryAfterSeconds: 30,
  },
  mistral: {
    provider: 'mistral',
    requestsPerMinute: 30,
    tokensPerMinute: 500000,
    dailyRequestCeiling: 1000,
    monthlyTokenBudget: 25000000,
    retryAfterSeconds: 60,
  },
};
```

---

## 4. Cost Control & Abuse Prevention Controls

1. **Client-Side UX Rate Limiting**:
   - Free tier daily ceiling: 50 requests/day per student (`maxDailyRequests: 50`).
   - Per-request output token bound: 2,048 tokens (Shanky), 4,096 tokens (Banku).
   - In-memory request deduplication and debounce on rapid triggers.
2. **Server-Side Authoritative Enforcement**:
   - Supabase Edge Function `ai-gateway` authenticates JWT identity.
   - Enforces user tenant boundary (`request.userId === authenticatedUser.id`).
   - Returns HTTP 429 with sanitized error on provider threshold crossings.
3. **Local Response Caching (`AICacheService`)**:
   - Daily briefing cached with composite key `briefing_<userId>_<date>_<hash>`.
   - Attendance explainer cached for 30 minutes unless attendance counts change.
   - Zero redundant network calls on tab renders.
4. **Denial-of-Wallet & Infinite Loop Defense**:
   - Router allows exactly 1 retryable fallback attempt for Banku (`gemini-3.8-flash` -> `gemini-3.7-flash`).
   - Non-retryable errors (401, 403, 400, policy violations, context leaks) **abort immediately** with zero retry.
   - Automated retries are strictly forbidden when quota has been reached.

---

## 5. Error Classification & Provider Responses

| HTTP Status | Error Type | Router Behavior | User Experience |
| :--- | :--- | :--- | :--- |
| **429** | `AIProviderRateLimitError` | Fallback if Banku slot 1; otherwise abort | *"Temporarily rate-limited. Please retry in a moment."* |
| **500 / 503** | `AIError (isRetryable)` | Fallback if Banku slot 1; otherwise abort | *"Provider temporarily unavailable. Showing local academic summary."* |
| **401 / 403** | `AIProviderAuthError` | Immediate abort (non-retryable) | Server configuration alert / safe fallback |
| **400** | `AIInvalidRequestError` | Immediate abort (non-retryable) | Form validation feedback |
| **Policy Rejection**| `AIPolicyRejectionError` | Immediate abort (non-retryable) | Request rejected by safety policy |
