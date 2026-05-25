-- Drop the foreign key constraint on public.tasks.supervisor_id 
-- to allow teacher IDs to be stored in the column (assignee ID).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_supervisor_id_fkey;
