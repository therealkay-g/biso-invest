'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Wallet, TrendingUp, Users, ShieldCheck } from 'lucide-react'
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
    description: 'L\'endroit idéal pour faire fructifier votre capital en investissant dans l\'économie réelle de la RDC.',
    icon: ShieldCheck,
    color: 'bg-emerald-500',
  },
  {
    title: 'Gérez votre Portefeuille',
    description: 'Consultez votre solde, effectuez des dépôts et suivez vos gains quotidiens en temps réel depuis votre Wallet.',
    icon: Wallet,
    color: 'bg-blue-500',
  },
  {
    title: 'Investissez Simplement',
    description: 'Choisissez parmi nos packs (Pisciculture, Agriculture, etc.) et recevez des revenus mensuels répartis chaque jour.',
    icon: TrendingUp,
    color: 'bg-amber-500',
  },
  {
    title: 'Bâtissez votre Équipe',
    description: 'Invitez vos proches et gagnez des commissions sur leurs investissements grâce à notre système de parrainage.',
    icon: Users,
    color: 'bg-purple-500',
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

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Mark as completed in Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ has_completed_onboarding: true })
          .eq('id', user.id)
      }
      setIsOpen(false)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ has_completed_onboarding: true })
        .eq('id', user.id)
    }
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
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`w-20 h-20 ${step.color} rounded-3xl flex items-center justify-center text-white shadow-lg mb-2`}>
            <Icon className="w-10 h-10" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-tight">
              {step.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
              {step.description}
            </p>
          </div>

          <div className="flex items-center justify-center space-x-2 py-2">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-emerald-500' : 'w-1.5 bg-gray-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>

          <div className="w-full flex flex-col gap-3 pt-4">
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>C'est parti !</span>
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
              className="absolute bottom-6 left-6 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
