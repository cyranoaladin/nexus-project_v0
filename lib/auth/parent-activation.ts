import { NextResponse } from 'next/server'

import {
  createActivationToken,
  type ActivationPurpose,
  type ActivationToken,
} from '@/lib/auth/activation-token'
import { sendMail, type SendMailResult } from '@/lib/email/mailer'

export const PARENT_ACTIVATION_PUBLIC_MESSAGE =
  "Si la demande peut etre traitee, un courriel d'activation sera envoye."

export type ParentActivationToken = ActivationToken

export type ParentActivationEmail = {
  subject: string
  html: string
  text: string
}

export function normalizeParentEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase()
}

export function createParentActivationToken(now = new Date()): ParentActivationToken {
  return createActivationToken('parent', now)
}

function isLocalOrigin(url: URL): boolean {
  return (
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  )
}

export function getTrustedApplicationOrigin(): URL {
  const configuredOrigin = process.env.NEXTAUTH_URL?.trim()
  if (!configuredOrigin) throw new Error('PARENT_ACTIVATION_ORIGIN_INVALID')

  let origin: URL
  try {
    origin = new URL(configuredOrigin)
  } catch {
    throw new Error('PARENT_ACTIVATION_ORIGIN_INVALID')
  }

  if (origin.protocol !== 'https:' && !isLocalOrigin(origin)) {
    throw new Error('PARENT_ACTIVATION_ORIGIN_INVALID')
  }

  origin.pathname = '/'
  origin.search = ''
  origin.hash = ''
  return origin
}

export function buildTrustedActivationUrl(
  rawToken: string,
  source?: 'stage',
  purpose: ActivationPurpose = 'parent',
): URL {
  const url = new URL('/auth/activate', getTrustedApplicationOrigin())
  url.searchParams.set('token', rawToken)
  url.searchParams.set('purpose', purpose)
  if (source) url.searchParams.set('source', source)
  return url
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function sanitizeInlineText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\b(?:bcc|cc|to|from|subject)\s*:/gi, '')
    .trim()
}

export function buildParentActivationEmail(input: {
  parentName: string
  childFirstName: string
  rawToken: string
}): ParentActivationEmail {
  const parentName = sanitizeInlineText(input.parentName) || 'Parent'
  const childFirstName = sanitizeInlineText(input.childFirstName) || 'votre enfant'
  const activationUrl = buildTrustedActivationUrl(input.rawToken, undefined, 'parent').toString()
  const safeParentName = escapeHtml(parentName)
  const safeChildFirstName = escapeHtml(childFirstName)
  const safeActivationUrl = escapeHtml(activationUrl)

  return {
    subject: 'Activez votre espace parent Nexus Reussite',
    text: [
      `Bonjour ${parentName},`,
      '',
      `Votre demande pour ${childFirstName} a bien ete enregistree.`,
      "Activez votre espace parent et choisissez votre mot de passe a l'adresse suivante :",
      activationUrl,
      '',
      'Ce lien est personnel, temporaire et utilisable une seule fois.',
    ].join('\n'),
    html: [
      `<p>Bonjour ${safeParentName},</p>`,
      `<p>Votre demande pour ${safeChildFirstName} a bien ete enregistree.</p>`,
      '<p>Activez votre espace parent et choisissez votre mot de passe :</p>',
      `<p><a href="${safeActivationUrl}">Activer mon espace parent</a></p>`,
      '<p>Ce lien est personnel, temporaire et utilisable une seule fois.</p>',
    ].join(''),
  }
}

export function buildAccountActivationEmail(input: {
  displayName: string
  rawToken: string
  accountRole: 'PARENT' | 'ELEVE'
  source?: 'stage'
}): ParentActivationEmail {
  const displayName = sanitizeInlineText(input.displayName) || 'Utilisateur'
  const activationUrl = buildTrustedActivationUrl(
    input.rawToken,
    input.source,
    input.accountRole === 'PARENT' ? 'parent' : 'student',
  ).toString()
  const safeDisplayName = escapeHtml(displayName)
  const safeActivationUrl = escapeHtml(activationUrl)

  return {
    subject: 'Activation de votre compte Nexus Reussite',
    text: [
      `Bonjour ${displayName},`,
      '',
      'Activez votre compte et choisissez votre mot de passe :',
      activationUrl,
      '',
      'Ce lien est personnel, temporaire et utilisable une seule fois.',
    ].join('\n'),
    html: [
      `<p>Bonjour ${safeDisplayName},</p>`,
      '<p>Activez votre compte et choisissez votre mot de passe :</p>',
      `<p><a href="${safeActivationUrl}">Activer mon compte</a></p>`,
      '<p>Ce lien est personnel, temporaire et utilisable une seule fois.</p>',
    ].join(''),
  }
}

export async function sendParentActivationEmail(input: {
  to: string
  parentName: string
  childFirstName: string
  rawToken: string
}): Promise<SendMailResult> {
  const message = buildParentActivationEmail(input)
  return sendMail({
    to: normalizeParentEmail(input.to),
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
}

export function withActivationSecurityHeaders<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export function isAccountActivationRequired(
  role: string,
  activatedAt: Date | null | undefined
): boolean {
  return (role === 'PARENT' || role === 'ELEVE') && !activatedAt
}
