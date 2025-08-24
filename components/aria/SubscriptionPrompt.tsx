'use client';

import Link from 'next/link';

export function SubscriptionPrompt({ onClose }: { onClose: () => void; }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" data-testid="subscription-prompt">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4 text-bleu-primaire font-poppins">Limite de la version découverte atteinte !</h2>
        <p className="mb-6 text-gray-700">Pour obtenir des réponses complètes, un suivi personnalisé et un accès illimité, passez à un abonnement premium.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/abonnements" className="bg-rouge-corail hover:bg-opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Voir les abonnements
          </Link>
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Peut-être plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
