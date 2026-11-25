# KaryaDEX — AI Security & Threat Model (Phase 12)

## 1. Golden Rules Enforcement
1. **Rule 1 — Deterministic Academic Math:** AI outputs are validated against system truth. Any discrepancy > 0.1% or fabricated safe bunk capacity triggers immediate rejection.
2. **Rule 2 — Zero Direct Database Writes:** AI code has no direct database handles. AI produces strictly typed `AIProposal` objects that require explicit user review and confirmation before application services execute SQLite writes.
3. **Rule 3 — User Data Boundary:** Prompts are assembled by `AIContextBuilder`, querying only authenticated user records. Complete database dumps are strictly prohibited.
4. **Rule 4 — API Key Isolation:** Zero model keys exist in mobile client code, `.env`, or Expo bundles. Production calls route to Supabase Edge Functions with server-side secrets.

---

## 2. Prompt Injection Defense
All user-supplied content (student notes, syllabus text, scanned PDFs, OCR text, task descriptions) is classified as **UNTRUSTED USER CONTENT**.

### 4-Layer Prompt Defense Structure:
```
Layer 1: === SYSTEM POLICY ===
         - Deterministic math non-override rules
         - Instruction to treat untrusted blocks purely as passive data
         - Persona system instructions

Layer 2: === TRUSTED APPLICATION DATA ===
         - Authoritative engine outputs (attendance %, safe bunks, registered subjects)

Layer 3: === UNTRUSTED USER CONTENT ===
         - Content enclosed in <untrusted_student_note> or <untrusted_user_content> tags
         - Boundary breakout neutralization (regex sanitization replaces </untrusted...> tags with [neutralized_tag])

Layer 4: === USER REQUEST ===
         - Specific feature action request
```

---

## 3. Malicious Document Boundary
Before any image or PDF is processed by Banku:
1. **Filename Validation:** Path traversal sequences (`..`, `%00`, encoded slashes) are rejected. Maximum length: 255 characters.
2. **Extension Check:** Executable and script extensions (`.exe`, `.sh`, `.bat`, `.apk`, `.js`) are prohibited.
3. **Magic-Byte Signature:** Verifies PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and PDF (`%PDF-`) headers. Mismatched or spoofed files are rejected.
4. **Size Cap:** Enforces strict 50MB file size limit to prevent Denial-of-Service / memory exhaustion.

---

## 4. Quota & Denial-of-Wallet Controls
- Tracks daily request counts and estimated token consumption per user.
- Daily cap defaults to 50 requests/day on Free tier.
- BYOK keys allow personal quota bypass without exposing master backend resources.
