'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const GUIDE_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Comment choisir un pack ?',
    body: 'Les packs officiels BISO INVEST sont au prix de 20 000 FC (VIP1), 50 000 FC (VIP2), 100 000 FC (VIP3) et 250 000 FC (VIP4). Votre niveau VIP est déterminé par le total de vos investissements : chaque palier débloque les packs de son niveau et augmente le nombre de packs détenus simultanément (3, 5, 8 ou 10 packs).',
  },
  {
    title: 'Comment investir ?',
    body: 'Ouvrez le pack souhaité, choisissez la quantité puis validez. Le capital est immédiatement débité de votre portefeuille, qui doit disposer du solde suffisant. Votre investissement démarre ensuite avec des cycles mensuels de revenus.',
  },
  {
    title: 'Revenu mensuel prévu',
    body: 'Chaque mois, votre pack verse son revenu mensuel pendant sa durée (par exemple : Tilapia 20 000 FC → revenu mensuel de 20 000 FC, sur 12 mois). Le montant exact affiché sur la page du pack fait foi.',
  },
  {
    title: 'Bénéfice quotidien',
    body: 'Le revenu mensuel est réparti sur le nombre réel de jours du mois (28, 29, 30 ou 31). Le bénéfice quotidien correspond donc au revenu mensuel divisé par les jours réels du mois.',
  },
  {
    title: 'Vendre : réclamer son bénéfice',
    body: 'Sur la page Investissements, le bouton « VENDRE » permet d\u2019encaisser le bénéfice quotidien disponible de votre investissement. Une fois réclamé, le montant est crédité sur votre portefeuille.',
  },
  {
    title: 'Bénéfice quotidien non réclamé',
    body: 'Un bénéfice quotidien non réclamé le jour même est perdu : il n\u2019est jamais reporté au lendemain. Pensez à réclamer votre bénéfice chaque jour.',
  },
  {
    title: 'Comment effectuer un retrait ?',
    body: 'Depuis votre portefeuille, demandez un retrait vers votre compte Mobile Money. La demande passe par une vérification administrative : après approbation, le montant net est envoyé sur le compte Mobile Money renseigné.',
  },
  {
    title: 'Montant minimum de retrait',
    body: 'Le retrait minimum est fixé à 5 000 FC.',
  },
  {
    title: 'Frais de retrait',
    body: 'Des frais de retrait de 15 % s\u2019appliquent sur le montant demandé. Le montant net (brut − 15 %) est celui qui parvient sur votre compte Mobile Money.',
  },
  {
    title: 'Niveaux VIP',
    body: 'Quatre paliers sont actifs : VIP1 (20 000 FC), VIP2 (50 000 FC), VIP3 (100 000 FC) et VIP4 (250 000 FC). Ils permettent de détenir 3, 5, 8 ou 10 packs simultanément. Le niveau est calculé automatiquement sur le total de vos investissements.',
  },
  {
    title: 'Tâches d\u2019invitation',
    body: 'Invitez des proches grâce à votre code : une invitation devient valable lorsqu\u2019un invité s\u2019inscrit avec votre code et effectue un investissement. Récompenses automatiques : 1 invitation → 3 000 FC, 5 → 15 000 FC, 10 → 30 000 FC, 20 → 60 000 FC, 50 → 200 000 FC, 100 → 500 000 FC. Les récompenses sont créditées automatiquement sur votre portefeuille (voir la page Tâche).',
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard" className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-bold text-gray-800 text-sm">Guide de bienvenue</h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-5 text-white shadow-md">
          <h2 className="text-xl font-extrabold tracking-tight">BISO INVEST</h2>
          <p className="text-sm text-emerald-100 mt-1">
            « Ensemble, construisons demain. » Comprendre les règles, c&apos;est la clé pour
            investir en toute sérénité.
          </p>
        </div>

        {GUIDE_SECTIONS.map((section, index) => (
          <section
            key={section.title}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center justify-center">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{section.body}</p>
              </div>
            </div>
          </section>
        ))}

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">Rappel :</span> les montants affichés sur votre espace
            (portefeuille, investissements, retraits) sont les seules valeurs qui comptent. Ce
            guide est purement informatif.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="block w-full text-center px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold shadow-sm hover:from-emerald-700 hover:to-emerald-800 transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}