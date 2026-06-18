'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';

interface CatalogueFiltersProps {
  onFilterChange: (filters: {
    type?: string;
    subject?: string;
    difficulty?: string;
  }) => void;
}

export function CatalogueFilters({ onFilterChange }: CatalogueFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    type: '',
    subject: '',
    difficulty: '',
  });

  const filters = {
    type: [
      { value: '', label: 'Tous les types' },
      { value: 'intensive', label: 'Sessions Intensives' },
      { value: 'annual', label: 'Passes Annuels' },
      { value: 'pass', label: 'Packs Flexibles' },
    ],
    subject: [
      { value: '', label: 'Tous les sujets' },
      { value: 'math', label: 'Mathématiques' },
      { value: 'french', label: 'Français' },
      { value: 'history', label: 'Histoire-Géo' },
      { value: 'languages', label: 'Langues' },
    ],
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...selectedFilters, [key]: value };
    setSelectedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setSelectedFilters({
      type: '',
      subject: '',
      difficulty: '',
    });
    onFilterChange({});
  };

  const hasActiveFilters =
    selectedFilters.type || selectedFilters.subject || selectedFilters.difficulty;

  return (
    <>
      {/* Mobile Filter Toggle */}
      <div className="md:hidden mb-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg"
        >
          <span className="flex items-center gap-2 font-bold text-primary">
            <Filter className="w-4 h-4" />
            Filtres
          </span>
          <span className="text-sm text-muted-foreground">
            {hasActiveFilters ? '✓ Actifs' : 'Voir plus'}
          </span>
        </button>
      </div>

      {/* Filters Container */}
      <div
        className={`${
          isOpen
            ? 'block mb-6'
            : 'hidden md:block'
        } md:sticky md:top-24 p-6 bg-card border border-border rounded-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-primary text-lg">Filtrer par</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-bold text-accent hover:text-accent/80"
            >
              <X className="w-3 h-3" />
              Réinitialiser
            </button>
          )}
        </div>

        {/* Type Filter */}
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-3">
            Type d\'offre
          </label>
          <div className="space-y-2">
            {filters.type.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={selectedFilters.type === option.value}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
                />
                <span className="text-body-sm text-foreground">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Subject Filter */}
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-3">
            Matière
          </label>
          <div className="space-y-2">
            {filters.subject.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="subject"
                  value={option.value}
                  checked={selectedFilters.subject === option.value}
                  onChange={(e) => handleFilterChange('subject', e.target.value)}
                  className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
                />
                <span className="text-body-sm text-foreground">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden w-full mt-6 py-2 bg-primary text-card font-bold rounded-lg"
        >
          Afficher les résultats
        </button>
      </div>
    </>
  );
}
