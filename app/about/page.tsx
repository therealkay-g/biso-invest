'use client'

import Header from '@/components/Header'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/profile" className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-bold text-gray-800 text-sm">À propos</h1>
        <div className="w-9"></div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-4 leading-relaxed text-sm text-gray-700">
          <div className="text-center pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">BISO INVEST</h2>
            <p className="text-sm text-biso-600 font-semibold mt-1">« Ensemble, construisons demain. »</p>
          </div>

          <p>
            Biso Invest est née d'une idée simple : l'avenir se construit ensemble.
          </p>
          <p>
            Dans de nombreuses communautés, des agriculteurs, éleveurs, commerçants, restaurateurs, transporteurs et entrepreneurs travaillent chaque jour pour développer leurs activités, mais l'accès au financement reste souvent difficile.
          </p>
          <p>
            Biso Invest a été imaginée pour créer un pont entre les personnes souhaitant participer à des projets économiques et les secteurs qui font vivre nos communautés.
          </p>
          <p>
            De l'agriculture à l'élevage, du commerce à la transformation, de l'énergie solaire au transport et à la restauration, notre ambition est de mettre en avant des opportunités liées à l'économie réelle.
          </p>
          <p>
            Biso signifie « nous ». Il représente une vision collective : le développement se construit ensemble.
          </p>
          <p>
            Notre objectif est de proposer une plateforme moderne, transparente et accessible, pensée pour l'Afrique et particulièrement pour la République démocratique du Congo.
          </p>

          <div className="pt-4 border-t border-gray-100 text-center">
            <p className="font-bold text-gray-900">BISO INVEST</p>
            <p className="text-xs text-gray-500">Ensemble, construisons demain.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
