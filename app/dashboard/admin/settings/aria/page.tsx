'use client';

// app/dashboard/admin/settings/aria/page.tsx
import { useEffect, useState } from 'react';

export default function AdminAriaSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amplify, setAmplify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/aria-config');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erreur de chargement');
        if (mounted) setAmplify(!!data?.amplify);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Erreur inconnue');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      const res = await fetch('/api/admin/aria-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amplify }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur de sauvegarde');
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Paramètres ARIA</h1>
      <p className="text-sm text-gray-600">Réglages de génération de cours PDF.</p>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded">
            <div>
              <p className="font-medium">Contenu dense (amplification)</p>
              <p className="text-sm text-gray-600">
                Demande au LLM d'amplifier le contenu (≥1200 mots, exemples détaillés, 3 exos
                corrigés + 3 non corrigés, etc.).
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={amplify}
                onChange={(e) => setAmplify(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 relative" />
            </label>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>

          {saved && <p className="text-green-700 text-sm">Sauvegardé ✔</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
