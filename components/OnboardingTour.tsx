'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, CheckCircle2, ShieldCheck, Smartphone, ArrowDownToLine, TrendingUp, HandCoins, Banknote, Users, Crown, BookOpen, Headphones } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface OnboardingStep {
  title: string
  description: string
  icon: React.ElementType
  color: string
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Bienvenue sur BISO INVEST',
    description: 'La plateforme congolaise d\'investissement dans l\'économie réelle : Agriculture, Élevage et Pisciculture. Votre capital est investi dans des projets concrets et génère des revenus chaque jour.',
    icon: ShieldCheck,
    color: 'bg-emerald-500',
  },
  {
    title: 'Votre Compte & Sécurité',
    description: 'Inscription simple avec votre numéro de téléphone, un mot de passe et éventuellement le code de parrainage d\'un proche. Votre profil et votre wallet sont créés automatiquement et vos transactions sont protégées par un ledger sécurisé.',
    icon: Smartphone,
    color: 'bg-sky-500',
  },
  {
    title: 'Recharger votre compte',
    description: 'Onglet Wallet : choisissez votre réseau Mobile Money (Airtel Money, Orange Money ou M-Pesa), envoyez votre argent sur le numéro officiel affiché (minimum 1 000 FC), puis téléversez la capture d\'écran du SMS de confirmation. Un admin valide ensuite votre dépôt.',
    icon: ArrowDownToLine,
    color: 'bg-blue-500',
  },
  {
    title: 'Investir dans un pack',
    description: 'Onglet Investir : choisissez parmi 3 secteurs (Agriculture, Élevage, Pisciculture). Chaque secteur propose 4 packs à 20 000, 50 000, 100 000 et 250 000 FC, sur un contrat de 15 jours pour l\'Agriculture et de 3 mois pour les autres secteurs. Le bénéfice est de 10 % du capital investi par jour éligible.',
    icon: TrendingUp,
    color: 'bg-amber-500',
  },
  {
    title: 'Vos bénéfices quotidiens',
    description: 'Chaque jour éligible, récupérez 10 % de votre capital investi, arrondis à 2 décimales (20 000 FC → 2 000 FC par jour, 50 000 FC → 5 000 FC, 250 000 FC → 25 000 FC). Cliquez sur VENDRE chaque jour : un bénéfice non réclamé est définitivement perdu et ne se reporte jamais.',
    icon: HandCoins,
    color: 'bg-teal-500',
  },
  {
    title: 'Retirer vos gains',
    description: 'Onglet Wallet → Retirer : le montant minimum est de 5 000 FC et les frais de retrait sont de 15 %. Votre argent est envoyé sur votre compte Mobile Money enregistré (Airtel, Orange ou M-Pesa), après validation de votre code PIN à 4 chiffres.',
    icon: Banknote,
    color: 'bg-red-500',
  },
  {
    title: 'Bâtissez votre équipe',
    description: 'Partagez votre code de parrainage (BISO + 6 caractères) depuis l\'onglet Tâche. Chaque filleul inscrit avec votre code qui investit vous rapporte 3 000 FC automatiquement, plus des bonus de 15 000, 30 000, 60 000, 200 000 et 500 000 FC selon votre progression (5, 10, 20, 50, 100 filleuls).',
    icon: Users,
    color: 'bg-violet-500',
  },
  {
    title: 'Progressez en VIP',
    description: 'Votre niveau VIP monte automatiquement selon votre total investi : VIP1 dès 20 000 FC, VIP2 à 50 000, VIP3 à 100 000 et VIP4 à 250 000 FC. Plus votre niveau est élevé, plus vous pouvez avoir de packs actifs simultanément (jusqu\'à 10).',
    icon: Crown,
    color: 'bg-purple-600',
  },
  {
    title: 'Apprenez avec BISO Academy',
    description: 'Onglet Académie : des cours gratuits pour devenir expert — Bases de l\'Investissement, Stratégies Avancées et Maîtrise du Parrainage. Validez chaque leçon pour suivre votre progression.',
    icon: BookOpen,
    color: 'bg-indigo-500',
  },
  {
    title: 'Suivi, aide et notifications',
    description: 'Restez informé grâce au centre de notifications (bénéfices disponibles, nouveaux filleuls, retraits approuvés) et aux notifications push. Besoin d\'aide ? Le service client répond à vos questions via la FAQ et les tickets de support.',
    icon: Headphones,
    color: 'bg-emerald-600',
  },
]

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  useEffect(() => {
    async function checkOnboarding() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setIsOpen(true)
    }

    checkOnboarding()
  }, [])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setIsOpen(false)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    setIsOpen(false)
  }

  if (!isOpen) return null

  const step = STEPS[currentStep]
  const Icon = step.icon

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="relative p-8 flex flex-col items-center text-center space-y-6">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 transition-colors"
            aria-label="Fermer le tutoriel"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`w-20 h-20 ${step.color} rounded-3xl flex items-center justify-center text-white shadow-lg mb-2`}>
            <Icon className="w-10 h-10" />
          </div>

          <div className="space-y-3 min-h-[128px] flex flex-col justify-center">
            <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-tight">
              {step.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
              {step.description}
            </p>
          </div>

          <div className="flex flex-col items-center space-y-2 py-2">
            <div className="flex items-center justify-center space-x-1.5">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-emerald-500' : 'w-1.5 bg-gray-200 dark:bg-zinc-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              {currentStep + 1} / {STEPS.length}
            </span>
          </div>

          <div className="w-full flex flex-col gap-3 pt-4">
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>J&apos;ai tout compris !</span>
                </>
              ) : (
                <>
                  <span>Continuer</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={handleSkip}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Passer le tutoriel
            </button>
          </div>

          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="absolute bottom-6 left-6 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Étape précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}