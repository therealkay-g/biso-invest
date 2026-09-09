'use client'

import React from 'react'
import { X, Printer, ShieldCheck, Award, QrCode } from 'lucide-react'
import { Investment } from '@/types'

interface CertificateProps {
  investment: Investment
  userName?: string
  onClose: () => void
}

export default function InvestmentCertificateModal({ investment, userName = 'Investisseur Agréé', onClose }: CertificateProps) {
  const handlePrint = () => {
    window.print()
  }

  const certificateNumber = `BISO-${new Date(investment.created_at).getFullYear()}-${investment.id.substring(0, 8).toUpperCase()}`
  const investmentDate = new Date(investment.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      {/* Container with screen / print styling */}
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl border border-gray-100 my-8">
        {/* Controls - Hidden on print */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100 print:hidden">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-biso-600" />
            <span className="font-extrabold text-xs uppercase tracking-wider text-gray-700">Certificat d'Investissement Officiel</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="bg-biso-600 hover:bg-biso-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Content */}
        <div id="printable-certificate" className="mt-4 p-6 border-4 border-double border-biso-700/40 rounded-2xl relative bg-linear-to-b from-amber-50/20 via-white to-biso-50/30">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
            <ShieldCheck className="w-80 h-80 text-biso-900" />
          </div>

          {/* Header */}
          <div className="text-center space-y-1 relative z-10 border-b pb-4 border-biso-700/20">
            <div className="flex justify-center items-center space-x-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-biso-700 text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                BI
              </div>
              <span className="text-base font-extrabold text-gray-900 tracking-tight">BISO INVEST SARL</span>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-biso-800">RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</p>
            <p className="text-[10px] text-gray-500">Plateforme de Financement Participatif de l'Économie Réelle</p>
            <div className="pt-2">
              <span className="inline-block px-3 py-1 bg-biso-700 text-white font-extrabold text-[11px] rounded-full uppercase tracking-wider shadow-xs">
                CERTIFICAT DE TITULARISATION DE PACK
              </span>
            </div>
          </div>

          {/* Body Info */}
          <div className="py-6 space-y-4 relative z-10 text-center">
            <p className="text-xs text-gray-600">
              Il est certifié par les présentes que :
            </p>
            <p className="text-lg font-black text-gray-900 uppercase tracking-wide border-b-2 border-dashed border-gray-300 pb-1 inline-block px-4">
              {userName}
            </p>
            <p className="text-xs text-gray-600">
              est dûment enregistré(e) en tant que propriétaire effectif(ve) du programme d'investissement économique :
            </p>

            {/* Pack details table */}
            <div className="bg-white/80 border border-biso-200 rounded-xl p-4 shadow-2xs text-left grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 text-[11px]">Désignation du Pack :</span>
                <p className="font-bold text-gray-900 text-sm">{investment.product?.name || 'Pack Investissement'}</p>
              </div>
              <div>
                <span className="text-gray-500 text-[11px]">N° Enregistrement :</span>
                <p className="font-mono font-bold text-biso-700 text-[11px]">{certificateNumber}</p>
              </div>
              <div>
                <span className="text-gray-500 text-[11px]">Capital Investi :</span>
                <p className="font-extrabold text-emerald-800 text-sm">
                  {investment.total_amount.toLocaleString('fr-FR')} FC
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-[11px]">Rendement Mensuel Contractuel :</span>
                <p className="font-bold text-biso-700 text-sm">
                  {(investment.monthly_return * investment.quantity).toLocaleString('fr-FR')} FC / mois
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-[11px]">Durée de l'Engagement :</span>
                <p className="font-bold text-gray-800">{investment.duration_months} Mois (12 Cycles)</p>
              </div>
              <div>
                <span className="text-gray-500 text-[11px]">Date de Souscription :</span>
                <p className="font-bold text-gray-800">{investmentDate}</p>
              </div>
            </div>
          </div>

          {/* Footer with Stamp & QR */}
          <div className="pt-4 border-t border-biso-700/20 flex justify-between items-end relative z-10 text-[10px]">
            <div className="flex items-center space-x-2">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <QrCode className="w-10 h-10 text-gray-800" />
              </div>
              <div className="text-left text-[9px] text-gray-500">
                <p className="font-bold text-gray-700">Authentification Numérique</p>
                <p>Scannez pour vérifier le registre blockchain/SQL</p>
              </div>
            </div>

            {/* Official Stamp styling */}
            <div className="border-2 border-biso-700 rounded-full w-24 h-24 p-1 flex items-center justify-center rotate-[-12deg] text-center opacity-85 shadow-2xs">
              <div className="border border-dashed border-biso-600 rounded-full w-full h-full flex flex-col items-center justify-center text-[8px] font-black text-biso-800 uppercase leading-tight">
                <span>BISO INVEST</span>
                <span className="text-[7px] text-emerald-600 font-bold">DIRECTION FINANCES</span>
                <span>CONFORME</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-[10px] text-gray-400 mt-4 print:hidden">
          Ce certificat numérique fait foi de preuve légale d'investissement auprès de Biso Invest SARL sous les lois de la RDC.
        </p>
      </div>
    </div>
  )
}
