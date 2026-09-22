/**
 * BISO INVEST — Interface Abstraite de Passerelle SMS
 * Préparée pour l'intégration en production (Africa's Talking, Twilio, Orange, etc.)
 * Ne contient aucun secret ni identifiant en dur.
 */

export interface SmsSendOptions {
  to: string
  message: string
}

export interface SmsSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface ISmsProvider {
  name: string
  sendSms(options: SmsSendOptions): Promise<SmsSendResult>
}
