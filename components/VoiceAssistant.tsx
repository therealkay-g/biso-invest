'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeWallet } from '@/components/RealtimeProvider'

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState('')
  const { wallet } = useRealtimeWallet()
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'fr-FR'

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript
        setTranscript(text)
        handleVoiceCommand(text)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
    }
  }, [wallet])

  const speak = (text: string) => {
    if (isMuted) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'fr-FR'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  const handleVoiceCommand = (text: string) => {
    const query = text.toLowerCase()

    if (query.includes('solde') || query.includes('argent') || query.includes('combien')) {
      const balance = wallet?.balance || 0
      speak(`Votre solde actuel est de ${balance.toLocaleString('fr-FR')} Francs Congolais.`)
    } else if (query.includes('gain') || query.includes('profit')) {
      const earned = wallet?.total_earned || 0
      speak(`Vous avez gagné un total de ${earned.toLocaleString('fr-FR')} Francs Congolais depuis le début.`)
    } else if (query.includes('bonjour') || query.includes('salut')) {
      speak('Bonjour ! Je suis votre assistant vocal BISO. Comment puis-je vous aider ?')
    } else if (query.includes('aide')) {
      speak('Vous pouvez me demander votre solde, vos gains totaux ou simplement me dire bonjour.')
    } else {
      speak('Je n\'ai pas compris votre demande. Essayez de me demander votre solde ou vos gains.')
    }
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      setTranscript('')
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  if (typeof window === 'undefined' || !recognitionRef.current) return null

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col items-end space-y-3">
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-full shadow-lg border border-emerald-500/30 flex items-center gap-3 animate-bounce-slow"
          >
            <div className="flex gap-1">
              <span className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="w-1 h-5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="text-xs font-bold text-gray-600 dark:text-zinc-300 italic">
              {transcript || 'Je vous écoute...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-3 rounded-2xl shadow-lg transition-all ${isMuted ? 'bg-gray-200 text-gray-500' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleListening}
          className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-90 ${
            isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white'
          }`}
        >
          {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>
    </div>
  )
}
