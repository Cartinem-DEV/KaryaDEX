# Security Policy

KaryaDEX is designed with a **privacy-first, zero-knowledge architectural model**. We take security, student privacy, and credential safety seriously.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability, **please do NOT open a public GitHub issue**.

Instead, report it privately:
- **Email:** `security@karyadex.org` (or contact the repository maintainers via GitHub Security Advisories)
- **Response SLA:** You will receive an initial response within 48 hours acknowledging receipt.
- **Resolution Timeline:** Valid vulnerabilities will be addressed with a patched release within 14 days.

Please provide:
1. Description of the vulnerability.
2. Steps to reproduce or proof-of-concept payload.
3. Potential impact on user data or infrastructure.

---

## Core Security & Privacy Principles

### 1. Zero Client-Side Secret Leakage
- **No Provider Keys in Client Bundles:** Under no circumstances are LLM provider API keys (`GEMINI_API_KEY`, `MISTRAL_API_KEY`, etc.) or backend `service_role` secrets embedded in the Expo application or web bundle.
- **Client Configuration:** Only public identifiers (`EXPO_PUBLIC_SUPABASE_URL`, public publishable anon key, Google OAuth Client ID) are included in client bundles.

### 2. Bring-Your-Own-Key (BYOK) Security
- **Hardware-Backed Storage:** On physical mobile devices (Android / iOS), user-entered API keys are encrypted in hardware-backed keystores using `expo-secure-store` (Android Keystore / iOS Keychain).
- **Ephemeral Web Memory:** On the web client, BYOK keys are maintained solely in ephemeral in-memory state. They are **never** persisted to `localStorage`, `IndexedDB`, or SQLite.
- **Zero Cloud Sync:** BYOK keys are never synchronized to Supabase, cloud databases, or third-party analytics.

### 3. Edge Gateway Security Architecture
All production AI interactions route through an edge proxy (Cloudflare Workers AI Gateway):
- **Mandatory JWT Authentication:** Every incoming request must provide a valid Supabase Auth JWT (`Authorization: Bearer <token>`). Unauthenticated requests are rejected immediately with HTTP 401.
- **Strict Tenant Boundaries:** Requests are validated against `verifiedUserId === request.userId`. Cross-tenant execution is rejected with HTTP 403.
- **Quota & Abuse Prevention:** Enforces rate limits and daily request ceilings per user using atomic Workers KV counters.
- **Sanitized Responses:** Server-side API responses strip all internal telemetry, authorization headers, and provider credentials before returning sanitized payloads to the client.

### 4. Local SQLite Sandboxing
- Offline data, study plans, attendance logs, and practice records reside in an isolated SQLite database on the local device filesystem.
- Database operations enforce schema migrations, foreign-key cascades, and transactional integrity.

### 5. File System & Storage Access Framework (SAF)
- File uploads are validated using file magic-bytes inspection (`%PDF-`, PNG, JPEG) rather than trusting client MIME headers.
- Path traversal protection strips directory separators (`../`, `..\`) and Windows-reserved device names (`CON`, `PRN`, `AUX`, `NUL`).
- Strict 50MB file size ceiling prevents memory exhaustion.
- Executable and script binaries (`.exe`, `.apk`, `.bat`, `.cmd`, `.sh`, `.dll`, `.bin`, `.ps1`) are permanently prohibited.
