import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { userId, message } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    // Authentification par session (cookies) — jamais de trust du userId du body
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (userId && userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Récupération du contexte utilisateur (RLS limite aux données du user connecté)
    const [profileRes, walletRes, investmentsRes, productsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('investments').select('*, product:products(*)').eq('user_id', user.id),
      supabase.from('products').select('*').eq('is_active', true),
    ])

    const profile = profileRes.data
    const wallet = walletRes.data
    const investments = investmentsRes.data
    const products = productsRes.data

    if (!profile || !wallet) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 })
    }

    // 2. Construction du contexte IA (serait envoyé à un vrai LLM)
    const context = `
      User Profile:
      - Phone: ${profile.phone}
      - VIP Level: ${profile.current_vip}
      - Total Invested: ${wallet.total_invested} FC
      - Current Balance: ${wallet.balance} FC

      Active Investments:
      ${investments?.map(inv => `- ${inv.product?.name}: ${inv.total_amount} FC`).join('\n')}

      Available Investment Packs:
      ${products?.map(p => `- ${p.name}: ${p.price} FC (Return: ${p.monthly_return} FC/mo)`).join('\n')}
    `

    // 3. SIMULATION de la logique IA (en attendant un vrai LLM)
    let aiResponse = ""
    const query = message.toLowerCase()

    if (query.includes('conseil') || query.includes('que faire') || query.includes('investir')) {
      if (wallet.balance >= 100000) {
        const bestPack = products?.find(p => p.price <= wallet.balance && p.price >= 100000)
        aiResponse = `D'après votre solde de ${wallet.balance} FC, je vous suggère fortement le ${bestPack?.name || 'pack supérieur'}. C'est le meilleur rapport rendement/risque pour votre niveau ${profile.current_vip}.`
      } else if (wallet.balance >= 20000) {
        aiResponse = "Vous avez assez pour débuter ! Le pack de base à 20 000 FC est une excellente porte d'entrée pour commencer à générer des gains quotidiens."
      } else {
        aiResponse = "Votre solde actuel est un peu bas pour un nouvel investissement. Je vous conseille d'attendre vos prochains gains quotidiens ou de faire un dépôt pour débloquer un nouveau pack."
      }
    } else if (query.includes('vip')) {
      aiResponse = `Vous êtes actuellement ${profile.current_vip}. Pour passer au niveau supérieur, continuez à investir. Plus votre capital total augmente, plus vos avantages VIP s'élargissent !`
    } else {
      aiResponse = "Je suis votre conseiller BISO. Je peux vous aider à choisir le meilleur pack d'investissement en fonction de votre solde et de votre niveau VIP. Posez-moi une question sur vos investissements !"
    }

    return NextResponse.json({
      response: aiResponse,
      context_used: true,
      userId: user.id
    })

  } catch (error: any) {
    console.error('AI Advisor Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}