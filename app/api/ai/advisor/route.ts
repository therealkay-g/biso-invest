import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { userId, message } = await req.json()

    if (!userId || !message) {
      return NextResponse.json({ error: 'Missing userId or message' }, { status: 400 })
    }

    // 1. Fetch User Context
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single()
    const { data: investments } = await supabase.from('investments').select('*, product:products(*)').eq('user_id', userId)
    const { data: products } = await supabase.from('products').select('*').eq('is_active', true)

    if (!profile || !wallet) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 })
    }

    // 2. Construct the AI Prompt (This would be sent to a real LLM like Claude/GPT)
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

    // SIMULATION of AI Logic (until real LLM API is connected)
    // In a real app: const response = await llm.complete({ prompt: context + "\\n\\nUser Question: " + message });

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
      userId: userId
    })

  } catch (error: any) {
    console.error('AI Advisor Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
