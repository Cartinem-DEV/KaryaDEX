-- ====================================================================
-- BunkMatKar — AI Usage Counters Table (Phase 12)
-- Daily quota tracking for AI Gateway (Supabase Edge Function + Cloudflare Worker fallback)
-- ====================================================================

-- Create AI Usage Counters table for daily quota tracking
CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own ai_usage_counters" ON public.ai_usage_counters
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_usage_counters" ON public.ai_usage_counters
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_usage_counters" ON public.ai_usage_counters
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_counters_user_date ON public.ai_usage_counters(user_id, usage_date);