-- Table pour les annonces globales envoyées par l'admin
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Politique de sécurité : Tout le monde peut lire les annonces actives, seul l'admin peut modifier.
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Annonces visibles par tous"
ON public.announcements FOR SELECT
USING (is_active = true);

-- On suppose que la table admin_users existe déjà pour les permissions d'écriture.
CREATE POLICY "Admin peut tout gérer"
ON public.announcements FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE admin_users.id = auth.uid()
    )
);
