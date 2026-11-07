# Contributing to KaryaDEX

Thank you for your interest in contributing to **KaryaDEX**! We welcome contributions from developers, designers, and students building the future of college life and academic operating systems.

---

## Code of Conduct

By participating in this project, you agree to uphold a welcoming, respectful, and harassment-free community environment for all contributors.

---

## Development Workflow

### 1. Prerequisites
- **Node.js**: `22.x` or `24.x` (LTS recommended)
- **Package Manager**: `npm` (bundled with Node)
- **Expo CLI**: `npx expo`
- **JDK (for Android development)**: Java 17, 21, or 25
- **Android SDK & platform-tools** (if testing Android native builds)

### 2. Fork and Clone
```bash
git clone https://github.com/<your-username>/karyadex.git
cd karyadex
```

### 3. Install Dependencies
```bash
# Install root workspace dependencies
npm install

# Install client app dependencies
cd KaryaDEX
npm install
```

### 4. Configure Environment
```bash
cd KaryaDEX
cp .env.example .env
```
Populate `.env` with your development Supabase credentials (or run in offline Guest Mode, which works without credentials).

### 5. Running the Application
```bash
# Web development (instant hot-reload)
npm run web

# Android development
npm run android
```

---

## Quality & Verification Gates

Before submitting a Pull Request, all changes must pass the automated verification gates:

```bash
# 1. Typecheck (Must exit with 0 errors)
npm run typecheck

# 2. Run Test Suite
npm run test
```

### Pull Request Rules
1. **Never commit secrets:** Never commit `.env` files, actual API keys, or private tokens.
2. **Preserve Database Migrations:** Do not alter landed schema migrations; add new sequential migrations in `database/migrations.ts`.
3. **Strict TypeScript:** Avoid `any` where strong interfaces exist in `types/`.
4. **Offline Resilience:** Ensure features degrade gracefully when unauthenticated or offline.
5. **Clear Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat(study): add spaced-repetition algorithm`, `fix(auth): handle expired token gracefully`).

---

## Architecture Overview

- **`KaryaDEX/app/`**: Expo Router declarative file-based navigation.
- **`KaryaDEX/components/`**: Modular UI components (Academic Hub, Study OS, LockIn, Playground).
- **`KaryaDEX/database/`**: SQLite migrations, schema definitions, and repository pattern.
- **`KaryaDEX/services/`**: Business logic, AI features, file storage, and analytics.
- **`KaryaDEX/store/`**: Zustand reactive state management.
- **`KaryaDEX/modules/expo-module-lockin/`**: Native Kotlin Android module for deep focus and app interception.
- **`workers/ai-gateway/`**: Cloudflare Workers edge proxy for authenticated AI inference.

---

## Questions or Need Help?

Join our community discussions on GitHub Issues or submit a draft PR for feedback!
