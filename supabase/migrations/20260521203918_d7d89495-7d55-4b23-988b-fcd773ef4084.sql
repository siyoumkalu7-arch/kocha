-- Lock search_path on trigger fn
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Revoke EXECUTE from anon on all helper functions; keep for authenticated (RLS needs it)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_parent_admin(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public, authenticated;