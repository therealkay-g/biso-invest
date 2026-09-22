-- La table announcements existe déjà (migration 003).
-- On s'assure que RLS est activé et on ajoute des policies admin.

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Annonces actives visibles par tous'
      AND tablename = 'announcements'
  ) THEN
    CREATE POLICY "Annonces actives visibles par tous"
    ON public.announcements FOR SELECT
    USING (is_published = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admin peut tout gérer les annonces'
      AND tablename = 'announcements'
  ) THEN
    CREATE POLICY "Admin peut tout gérer les annonces"
    ON public.announcements FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.id = auth.uid()
      )
    );
  END IF;
END $$;
