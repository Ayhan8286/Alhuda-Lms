-- Fix permissions for the optimized views and functions
-- Run this in the Supabase SQL Editor

-- Grant select on views to both authenticated and anonymous roles
GRANT SELECT ON dashboard_summary TO authenticated, anon;
GRANT SELECT ON teacher_student_counts TO authenticated, anon;
GRANT SELECT ON supervisor_stats_summary TO authenticated, anon;

-- Grant execution on the function
GRANT EXECUTE ON FUNCTION get_student_shift_counts() TO authenticated, anon;

-- Verification (Optional)
-- SELECT * FROM dashboard_summary;
