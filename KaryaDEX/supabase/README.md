# BunkMatKar Supabase Database Setup

## Overview
This directory contains the production-ready PostgreSQL migrations for the BunkMatKar Supabase backend.

## Architecture
- **Multi-Tenant Isolation:** Every table enforces `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
- **Row Level Security (RLS):** Enabled on all tables. Four strict policies (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) ensure `auth.uid() = user_id`.
- **Zero Cross-Tenant Leakage:** Unauthenticated queries return 0 rows. Users can never view or modify another student's academic records.

## Applying Migrations

### Option A: Via Supabase CLI (Recommended)
1. Link your Supabase project:
   ```bash
   npx supabase link --project-ref <your-project-id>
   ```
2. Push migrations:
   ```bash
   npx supabase db push
   ```

### Option B: Via Supabase Dashboard SQL Editor
1. Open your project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Copy the contents of `migrations/20261005000000_initial_schema.sql` and run the query.

## Client Environment Setup
In your app's `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-publishable-key>
```
Do **NOT** use the `service_role` secret in the client app.
