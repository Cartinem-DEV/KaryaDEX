# KaryaDEX — AI Privacy & Data Governance (Phase 12)

## 1. Data Classification Model
All application data handled in the AI layer is classified into four tiers:

| Tier | Description | Examples | Handling Policy |
| :--- | :--- | :--- | :--- |
| **PUBLIC** | Non-personal reference data | System instructions, calendar days, general study tips | Permitted in general prompts |
| **PERSONAL** | Student identity identifiers | Student name, degree program, college name | Minimized; only provided when explicitly configuring profile |
| **ACADEMIC** | Operational academic data | Today's timetable slots, attendance percentage, pending assignments | Permitted in scoped context for active query |
| **SENSITIVE** | Authentication tokens, secrets, credentials | JWT access tokens, passwords, Supabase keys, SecureStore items | **STRICTLY PROHIBITED**; detection triggers immediate rejection |

---

## 2. Pre-Dispatch Policy Inspection
Before any payload leaves the client or edge function:
- Regex filters scan for JWT formats, Bearer auth tokens, and known API key signatures (`AIza*`, `gsk_*`, `sbp_*`).
- Forbidden keys (`password`, `accessToken`, `refreshToken`, `serviceKey`) trigger an immediate `AIPolicyRejectionError`.
- `AIPolicy.sanitizeText()` redacts accidental credential strings into `[REDACTED_CREDENTIAL]`.

---

## 3. Privacy-Aware Telemetry & Audit
`aiAuditService` stores operational performance metrics:
- Logged fields: `userId`, `persona`, `provider`, `model`, `feature`, `timestamp`, `latencyMs`, `tokenUsage`, `success`.
- Prohibited fields: Raw student prompts, complete model output transcripts, user passwords, and auth tokens are **never stored** in local audit logs.
- Scoped to `userId` with max 100 entries per device.

---

## 4. Local AI Cache Privacy
- Cache entries are indexed by `userId + feature + versionKey`.
- Access strictly validates matching `userId`.
- Zero cross-user cache leakage in multi-user or shared device testing.

---

## 5. Mistral AI Provider Privacy & Data-Control Profile

### 5.1 Account Privacy & Model Training Opt-Out
- **Model Training Opt-Out**: Under Mistral AI API terms (La Plateforme API via `/v1/chat/completions`), customer prompt inputs and model completions are **never used to train or improve foundation models**.
- **Commercial API Key Standard**: Zero model fine-tuning on student queries is maintained by contractual terms of the Mistral API platform.

### 5.2 Data Retention Policy
- **Standard API Retention**: Mistral retains API request/response metadata and payloads for up to **30 days** solely for trust & safety abuse monitoring, after which logs are permanently deleted.
- **Zero Data Retention (ZDR)**: ZDR is available as an enterprise/organization agreement tier with Mistral AI. For KaryaDEX free/standard deployments, the 30-day abuse retention window is documented, and all inputs are pre-scrubbed before transmission.

### 5.3 Permitted vs. Prohibited Data Categories for Mistral
| Category | Permitted to Mistral | Enforced Restrictions |
| :--- | :--- | :--- |
| **Conversational Chat** | YES | Scoped to academic planning, tips, and conversational queries. |
| **Task Breakdown** | YES | Only high-level task title and subject name transmitted. |
| **Timetable / Schedule** | YES | Only slot time and subject title transmitted for query context. |
| **Student Academic Notes** | **NO (STRICTLY PROHIBITED)** | Student notes (`notes` table contents) are **never sent to Mistral** by default. Notes contain sensitive academic work and are kept on-device/local only. |
| **Credentials & Auth** | **NO (BLOCKED)** | JWTs, Supabase keys, API secrets, and passwords are regex-blocked by `AIPolicy`. |
| **Student Contact Info** | **NO (BLOCKED)** | Student email, phone numbers, and full names are filtered out. |
