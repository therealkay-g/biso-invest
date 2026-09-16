-- Table pour les alertes d'opportunités
CREATE TABLE IF NOT EXISTS public.opportunity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_pack_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les thèmes saisonniers
CREATE TABLE IF NOT EXISTS public.seasonal_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL, -- hex color
    secondary_color TEXT,
    is_active BOOLEAN DEFAULT false,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.opportunity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertes visibles par tous" ON public.opportunity_alerts FOR SELECT USING (is_active = true);
CREATE POLICY "Thèmes visibles par tous" ON public.seasonal_themes FOR SELECT USING (true);

-- Admin can manage everything
CREATE POLICY "Admin manage alerts" ON public.opportunity_alerts FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
CREATE POLICY "Admin manage themes" ON public.seasonal_themes FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
