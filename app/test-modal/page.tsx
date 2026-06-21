'use client';

import { useState } from 'react';
import StageReservationModal from '../stages/_components/StageReservationModal';

/**
 * Test-only page — mounts StageReservationModal for e2e a11y testing.
 * Not linked from nav; excluded from sitemap.
 */
export default function TestModalPage() {
  const [open, setOpen] = useState(false);

  const offer = {
    id: 'test-offer',
    title: 'Stage Maths Terminale',
    price: 450,
    hours: 18,
  };

  return (
    <div className="min-h-screen bg-lux-ink p-12">
      <button
        id="open-modal-btn"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink"
      >
        Ouvrir la réservation
      </button>
      <StageReservationModal offer={offer} open={open} setOpen={setOpen} />
    </div>
  );
}
