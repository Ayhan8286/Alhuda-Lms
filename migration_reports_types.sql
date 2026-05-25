-- Migration: Add multi-type reports support to daily_reports table
-- This allows daily reports, monthly attendance reports, monthly performance reports, and monthly class reports.

-- 1. Drop old constraint restricting only one report per student per day
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_student_id_date_key;

-- 2. Add report_type column with a default of 'daily'
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'daily';

-- 3. Add composite unique constraint for (student_id, date, report_type)
-- This allows one daily report per student per day, and one monthly report per type per month (when using normalized month-start dates like '2026-05-01')
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_student_id_date_report_type_key;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_student_id_date_report_type_key UNIQUE (student_id, date, report_type);
