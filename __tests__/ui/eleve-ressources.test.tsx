import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: 'ELEVE' } }, status: 'authenticated' })
}))

import EleveRessourcesPage from '@/app/dashboard/eleve/ressources/page'

describe('Élève – Ressources', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = fetchMock
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/student/resources')) {
        return Promise.resolve({ ok: true, json: async () => ([
          { id: 'r1', title: 'Probabilités conditionnelles', description: 'Intro...', subject: 'MATHEMATIQUES', type: 'Fiche', lastUpdated: new Date().toISOString() },
          { id: 'r2', title: 'Programmation fonctionnelle en NSI', description: 'Map/Filter/Reduce', subject: 'NSI', type: 'Document', lastUpdated: new Date().toISOString() },
        ]) })
      }
      return Promise.resolve({ ok: false, json: async () => ({}) })
    })
  })

  it('affiche la liste des ressources et permet de filtrer par matière', async () => {
    render(<EleveRessourcesPage />)

    expect(await screen.findByText('Ressources Pédagogiques')).toBeInTheDocument()

    // Deux cartes rendues
    expect(await screen.findByText('Probabilités conditionnelles')).toBeInTheDocument()
    expect(await screen.findByText('Programmation fonctionnelle en NSI')).toBeInTheDocument()

    // Le select de matières est visible
    expect(screen.getByText('Toutes les matières')).toBeInTheDocument()
  })
})

