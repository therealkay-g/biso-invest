'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Bot, User, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface FAQItem {
  question: string
  answer: string
  category: 'General' | 'Investment' | 'Wallet' | 'KYC'
}

const FAQ_DATABASE: FAQItem[] = [
  {
    category: 'General',
    question: 'C\'est quoi BISO INVEST ?',
    answer: 'BISO INVEST est une plateforme d\'investissement dans l\'économie réelle en RDC, spécialisée dans l\'agriculture et la pisciculture. Nous permettons aux particuliers de financer des projets productifs et de percevoir un bénéfice quotidien de 10 % du capital investi, pour chaque jour éligible du contrat de 3 mois.',
  },
  {
    category: 'Investment',
    question: 'Comment investir ?',
    answer: 'C\'est simple ! Allez dans l\'onglet "Investir", choisissez un pack qui correspond à votre budget (ex: Pack Pisciculture), validez le paiement et votre bénéfice de 10 % du capital investi sera disponible chaque jour éligible pendant le contrat de 3 mois.',
  },
  {
    category: 'Investment',
    question: 'Quand suis-je payé ?',
    answer: 'Chaque jour éligible, votre bénéfice est de 10 % du capital investi, arrondi à 2 décimales, et est disponible dans votre wallet. Vous pouvez "vendre" votre bénéfice chaque jour ; un jour non réclamé est perdu.',
  },
  {
    category: 'Wallet',
    question: 'Comment retirer mon argent ?',
    // Note: The user's app has specific withdrawal logic
    answer: 'Rendez-vous dans "Mon Portefeuille", ajoutez un compte Mobile Money (Airtel, Orange, M-Pesa) et demandez un retrait. Le montant minimum est de 5 000 FC.',
  },
  {
    category: 'KYC',
    question: 'Pourquoi faire le KYC ?',
    answer: 'Le KYC (Know Your Customer) est obligatoire pour sécuriser vos transactions et valider votre identité. C\'est une mesure de sécurité pour protéger vos fonds et lutter contre la fraude.',
  },
  {
    category: 'General',
    question: 'Comment fonctionne le parrainage ?',
    answer: 'Invitez vos proches via votre code de parrainage. Dès qu\'un filleul investit, vous recevez une commission directe sur votre wallet selon votre niveau VIP.',
  },
]

interface Message {
  id: string
  text: string
  sender: 'bot' | 'user'
  timestamp: Date
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Bonjour ! Je suis l'assistant BISO. Comment puis-je vous aider aujourd'hui ?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInputValue('')

    // Simulate bot thinking
    setTimeout(() => {
      const botMsg = findBestAnswer(userMsg.text)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: botMsg,
        sender: 'bot',
        timestamp: new Date(),
      }])
    }, 800)
  }

  const findBestAnswer = (query: string) => {
    const lowerQuery = query.toLowerCase()

    // Simple keyword matching
    const match = FAQ_DATABASE.find(item =>
      lowerQuery.includes(item.question.toLowerCase().substring(0, 10)) ||
      item.question.toLowerCase().includes(lowerQuery) ||
      (item.category === 'KYC' && lowerQuery.includes('kyc')) ||
      (item.category === 'Investment' && (lowerQuery.includes('investir') || lowerQuery.includes('pack'))) ||
      (item.category === 'Wallet' && (lowerQuery.includes('retrait') || lowerQuery.includes('argent')))
    )

    return match
      ? match.answer
      : "Désolé, je n'ai pas la réponse exacte à cette question. Vous pouvez contacter notre support via l'onglet 'Moi' ou consulter la page 'À propos'."
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end space-y-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 sm:w-96 h-[500px] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Assistant BISO</h3>
                  <span className="text-[10px] opacity-80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                    En ligne
                  </span>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-zinc-950">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-tl-none border border-gray-100 dark:border-zinc-700'
                  }`}>
                    <p>{msg.text}</p>
                    <span className={`text-[9px] block mt-1 opacity-50 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Posez votre question..."
                className="flex-1 p-3 bg-gray-100 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:text-zinc-100"
              />
              <button
                type="submit"
                className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all active:scale-90 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-90 group"
      >
        <MessageCircle className={`w-7 h-7 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
    </div>
  )
}
