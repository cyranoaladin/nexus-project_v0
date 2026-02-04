'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { Academy } from '@/data/stages/fevrier2026';

interface StagesReservationFormProps {
  academies: Academy[];
}

export function StagesReservationForm({ academies }: StagesReservationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    parent: '',
    phone: '',
    classe: '',
    academyId: '',
    email: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const selectedAcademy = academies.find(a => a.id === formData.academyId);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.parent.trim()) {
      newErrors.parent = 'Nom du parent requis';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Numéro de téléphone requis';
    } else if (!/^\+?[0-9\s]{8,}$/.test(formData.phone)) {
      newErrors.phone = 'Numéro invalide';
    }
    if (!formData.classe.trim()) {
      newErrors.classe = 'Classe de l\'élève requise';
    }
    if (!formData.academyId) {
      newErrors.academyId = 'Veuillez sélectionner une académie';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      analytics.ctaClick('reservation-form', 'Soumettre réservation');

      const response = await fetch('/api/reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: formData.parent,
          phone: formData.phone,
          classe: formData.classe,
          academyId: formData.academyId,
          academyTitle: selectedAcademy?.title || '',
          price: selectedAcademy?.earlyBirdPrice || 0,
          email: formData.email
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitSuccess(true);
        setFormData({
          parent: '',
          phone: '',
          classe: '',
          academyId: '',
          email: ''
        });
      } else {
        alert('Une erreur est survenue. Veuillez réessayer ou nous contacter directement.');
      }
    } catch (error) {
      console.error('Erreur soumission:', error);
      alert('Impossible de soumettre le formulaire. Veuillez vérifier votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-black text-green-900 mb-3">
          Demande envoyée avec succès !
        </h3>
        <p className="text-green-800 mb-6">
          Nous vous contactons dans les <strong>24h</strong> pour finaliser votre réservation.
        </p>
        <button
          onClick={() => setSubmitSuccess(false)}
          className="text-green-700 font-semibold underline hover:no-underline"
        >
          Faire une nouvelle demande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl border-2 border-white/20">
      <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 text-center">
        📋 Formulaire de Réservation Rapide
      </h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="academyId" className="block text-sm font-bold text-slate-900 mb-2">
            Académie choisie *
          </label>
          <select
            id="academyId"
            value={formData.academyId}
            onChange={(e) => handleInputChange('academyId', e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              errors.academyId ? 'border-red-500' : 'border-slate-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all`}
          >
            <option value="">-- Sélectionnez une académie --</option>
            {academies.map((academy) => (
              <option key={academy.id} value={academy.id}>
                {academy.title} - {academy.earlyBirdPrice} TND (Early Bird)
              </option>
            ))}
          </select>
          {errors.academyId && (
            <p className="text-red-600 text-sm mt-1">{errors.academyId}</p>
          )}
          {selectedAcademy && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>{selectedAcademy.badge}</strong> • {selectedAcademy.durationHours}h • {selectedAcademy.groupSizeMax} élèves max
              </p>
              <p className="text-xs text-blue-700 mt-1">{selectedAcademy.objective}</p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="parent" className="block text-sm font-bold text-slate-900 mb-2">
            Nom complet du parent *
          </label>
          <input
            type="text"
            id="parent"
            value={formData.parent}
            onChange={(e) => handleInputChange('parent', e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              errors.parent ? 'border-red-500' : 'border-slate-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all`}
            placeholder="Ex: Mohamed Ben Ali"
          />
          {errors.parent && (
            <p className="text-red-600 text-sm mt-1">{errors.parent}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-bold text-slate-900 mb-2">
            Téléphone *
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              errors.phone ? 'border-red-500' : 'border-slate-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all`}
            placeholder="+216 99 19 28 29"
          />
          {errors.phone && (
            <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-bold text-slate-900 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              errors.email ? 'border-red-500' : 'border-slate-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all`}
            placeholder="votre@email.com"
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="classe" className="block text-sm font-bold text-slate-900 mb-2">
            Classe de l'élève *
          </label>
          <input
            type="text"
            id="classe"
            value={formData.classe}
            onChange={(e) => handleInputChange('classe', e.target.value)}
            className={`w-full px-4 py-3 rounded-lg border-2 ${
              errors.classe ? 'border-red-500' : 'border-slate-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all`}
            placeholder="Ex: Terminale / Première"
          />
          {errors.classe && (
            <p className="text-red-600 text-sm mt-1">{errors.classe}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Envoi en cours...
            </span>
          ) : (
            '📅 Confirmer ma réservation'
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500 text-center mt-4">
        ✅ Vos données sont protégées et utilisées uniquement pour traiter votre demande.
      </p>
    </form>
  );
}
