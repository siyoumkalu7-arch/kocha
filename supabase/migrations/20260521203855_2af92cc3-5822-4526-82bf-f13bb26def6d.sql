-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  parent_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles table (security best practice — separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get current user role (highest priority)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'user' THEN 3
  END
  LIMIT 1
$$;

-- Returns parent admin id of a given user (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_parent_admin(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_admin_id FROM public.profiles WHERE id = _user_id
$$;

-- entries table
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  system NUMERIC NOT NULL DEFAULT 0,
  online NUMERIC NOT NULL DEFAULT 0,
  number NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  win NUMERIC NOT NULL DEFAULT 0,
  cash NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX entries_user_date_idx ON public.entries(user_id, entry_date DESC);

-- messages table (admin -> super_admin)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER entries_touch BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============

-- profiles: own row OR super_admin OR admin viewing their users
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND parent_admin_id = auth.uid())
);

-- profiles UPDATE: super_admin any; admin can toggle can_edit on their users
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND parent_admin_id = auth.uid())
);

-- profiles INSERT/DELETE handled by server (admin client). No client policy.

-- user_roles: only super_admin can read
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
);

-- entries SELECT: own; super_admin; admin if entry owner is their user
CREATE POLICY entries_select ON public.entries FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'admin') AND public.get_parent_admin(user_id) = auth.uid())
);

-- entries INSERT: only as self, only if user role
CREATE POLICY entries_insert ON public.entries FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- entries UPDATE: own and can_edit is true; or super_admin
CREATE POLICY entries_update ON public.entries FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_edit = true)
  )
);

-- entries DELETE: super_admin only
CREATE POLICY entries_delete ON public.entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- messages SELECT: sender, or super_admin
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
);

-- messages INSERT: admins only, as self
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
);

-- messages UPDATE: super_admin (mark as read)
CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Realtime for messages (super_admin notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;