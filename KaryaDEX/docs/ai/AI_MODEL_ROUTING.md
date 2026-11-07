# BunkMatKar — AI Model Routing & Fallback Specification (Phase 12)

## 1. Persona Configuration

### Banku (Heavy Lifter / Multimodal Vision AI)
- **Primary Slot:** Google Gemini 3.8 Flash (`gemini-3.8-flash`)
  - Features: Native multimodal inlineData (images and PDFs), structured JSON output, low temperature (0.2), modern thinking configuration.
- **Fallback Slot:** Google Gemini 3.7 Flash (`gemini-3.7-flash`)
  - Used when Gemini 3.8 Flash encounters retryable errors (rate limiting 429, 503, or network timeout).

### Shanky (Speedster / Conversational Logic AI)
- **Primary Slot:** Mistral AI (`ministral-8b-2512` - Ministral 3 8B)
  - Features: Ultra-low latency conversational inference, structured JSON output (`response_format: { type: 'json_object' }`), temperature (0.3–0.4).
  - Explicit stable model ID: `ministral-8b-2512`. Deprecated Mistral 7B / legacy Mistral 8B models and unstable aliases are strictly forbidden.
- **Independent Quota Rule:**
  - Shanky uses an **independent provider quota pool** from Google Gemini.
  - If Mistral encounters rate limits or errors, the router returns a graceful *"Shanky temporarily unavailable"* response and falls back to deterministic local templates.
  - Traffic is **NEVER** silently redirected to Google Gemini.

---

## 2. Capability-Based Routing Logic

```
if request.requiresVision || request.requiresPDF || request.persona === 'banku':
    Target Persona = Banku
    Execute Banku Primary (gemini-3.8-flash)
    Catch error:
        if error is Retryable (RateLimit, Timeout, TransientNetwork):
            Execute Banku Fallback (gemini-3.7-flash)
        else:
            Fail immediately (Policy Rejection, Auth Failure, Invalid Request)
else:
    Target Persona = Shanky
    Execute Shanky Primary (ministral-8b-2512 via Mistral)
    Catch error:
        if error is RateLimit or Unavailable:
            Return Graceful "Shanky Temporarily Unavailable" State
            (Strictly zero silent fallback to Google)
        else:
            Fail immediately (Policy Rejection, Auth Failure, Invalid Request)
```

---

## 3. Error Classification

| Error Class | Retryable? | Triggers Fallback? | Example |
| :--- | :--- | :--- | :--- |
| `AIProviderRateLimitError` | Yes | Yes | HTTP 429 Too Many Requests |
| `AIProviderTimeoutError` | Yes | Yes | Request exceeded 30s timeout |
| `AIError (isRetryable=true)` | Yes | Yes | HTTP 503 Service Unavailable |
| `AIProviderAuthError` | No | No | Invalid API key (HTTP 401/403) |
| `AIInvalidRequestError` | No | No | Malformed JSON, invalid slot times |
| `AIPolicyRejectionError` | No | No | Prompt injection or credential pattern detected |
| `AIContextViolationError` | No | No | Cross-user data access attempt |
| `AIQuotaExceededError` | No | No | Daily limit reached |
