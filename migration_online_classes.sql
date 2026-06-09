-- Migration: Online Classes Feature
-- Adds meet_link to teachers and creates online_sessions table

-- 1. Add meet_link column to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS meet_link TEXT;

-- 2. Create online_sessions table
CREATE TABLE IF NOT EXISTS online_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    meet_link TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    duration_mins INT NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_online_sessions_teacher ON online_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_online_sessions_student ON online_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_online_sessions_date ON online_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_online_sessions_status ON online_sessions(status);

-- 4. Enable RLS
ALTER TABLE online_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — allow all operations via anon key (matches existing app pattern)
CREATE POLICY "Allow all access to online_sessions" ON online_sessions
    FOR ALL USING (true) WITH CHECK (true);
