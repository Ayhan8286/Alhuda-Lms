-- Fix schema and permissions for the optimized views and functions
-- Run this in the Supabase SQL Editor

-- 1. Add missing columns that are causing 400 errors
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS performance_notes TEXT;
ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- 2. Grant select on views to both authenticated and anonymous roles
GRANT SELECT ON dashboard_summary TO authenticated, anon;
GRANT SELECT ON teacher_student_counts TO authenticated, anon;
GRANT SELECT ON supervisor_stats_summary TO authenticated, anon;

-- 3. Grant execution on the function
GRANT EXECUTE ON FUNCTION get_student_shift_counts() TO authenticated, anon;
