-- Drop constraint restricting sender_role to just admin/supervisor
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
