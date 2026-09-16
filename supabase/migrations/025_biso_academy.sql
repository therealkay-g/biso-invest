-- Table pour les cours de l'academy
CREATE TABLE IF NOT EXISTS public.academy_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les leçons de chaque cours
CREATE TABLE IF NOT EXISTS public.academy_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    duration_minutes INT DEFAULT 5,
    order_index INT DEFAULT 0,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour suivre la progression des utilisateurs
CREATE TABLE IF NOT EXISTS public.user_academy_progress (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);

-- Politique de sécurité : Tout le monde peut lire les cours, seul l'utilisateur peut marquer sa progression.
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_academy_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cours visibles par tous" ON public.academy_courses FOR SELECT USING (true);
CREATE POLICY "Leçons visibles par tous" ON public.academy_lessons FOR SELECT USING (true);

CREATE POLICY "Utilisateur peut suivre sa progression"
ON public.user_academy_progress FOR ALL
USING (auth.uid() = user_id);

-- Seed data pour l'academy
INSERT INTO public.academy_courses (title, description, category, order_index) VALUES
('Bases de l''Investissement', 'Apprenez les fondamentaux pour débuter sereinement.', 'Débutant', 0),
('Stratégies Avancées', 'Optimisez vos gains et gérez vos risques.', 'Intermédiaire', 1),
('Maîtriser le Parrainage', 'Devenez un leader et développez votre équipe.', 'Expert', 2);

-- Note: Lessons will be added via the app or a separate seed script.
