'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface DaySchedule {
  dayOfWeek: number;
  slots: TimeSlot[];
}

interface CoachAvailabilityProps {
  coachId: string;
  onAvailabilityUpdated?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi', shortLabel: 'Lun' },
  { value: 2, label: 'Mardi', shortLabel: 'Mar' },
  { value: 3, label: 'Mercredi', shortLabel: 'Mer' },
  { value: 4, label: 'Jeudi', shortLabel: 'Jeu' },
  { value: 5, label: 'Vendredi', shortLabel: 'Ven' },
  { value: 6, label: 'Samedi', shortLabel: 'Sam' },
  { value: 0, label: 'Dimanche', shortLabel: 'Dim' },
];

const DEFAULT_SLOTS = [
  { startTime: '09:00', endTime: '10:00', isAvailable: true },
  { startTime: '10:00', endTime: '11:00', isAvailable: true },
  { startTime: '11:00', endTime: '12:00', isAvailable: true },
  { startTime: '14:00', endTime: '15:00', isAvailable: true },
  { startTime: '15:00', endTime: '16:00', isAvailable: true },
  { startTime: '16:00', endTime: '17:00', isAvailable: true },
];

export default function CoachAvailability({
  coachId,
  onAvailabilityUpdated,
}: CoachAvailabilityProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'weekly' | 'specific'>('weekly');

  // Weekly schedule
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map((day) => ({
      dayOfWeek: day.value,
      slots: [],
    }))
  );

  // Specific date availability
  const [specificDate, setSpecificDate] = useState('');
  const [specificSlots, setSpecificSlots] = useState<TimeSlot[]>([]);

  const loadCurrentAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/coaches/availability?coachId=${coachId}`);
      const data = await response.json();

      if (data.success) {
        // Process and organize the availability data
        const schedule = DAYS_OF_WEEK.map((day) => {
          const daySlots = data.availability
            .filter((av: any) => av.isRecurring && av.dayOfWeek === day.value)
            .map((av: any) => ({
              startTime: av.startTime,
              endTime: av.endTime,
              isAvailable: av.isAvailable,
            }));

          return {
            dayOfWeek: day.value,
            slots: daySlots.length > 0 ? daySlots : [],
          };
        });

        setWeeklySchedule(schedule);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des disponibilités' });
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    loadCurrentAvailability();
  }, [loadCurrentAvailability]);

  const addTimeSlot = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              slots: [...day.slots, { startTime: '09:00', endTime: '10:00', isAvailable: true }],
            }
          : day
      )
    );
  };

  const removeTimeSlot = (dayOfWeek: number, slotIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              slots: day.slots.filter((_, index) => index !== slotIndex),
            }
          : day
      )
    );
  };

  const updateTimeSlot = (
    dayOfWeek: number,
    slotIndex: number,
    field: keyof TimeSlot,
    value: any
  ) => {
    setWeeklySchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              slots: day.slots.map((slot, index) =>
                index === slotIndex ? { ...slot, [field]: value } : slot
              ),
            }
          : day
      )
    );
  };

  const copyDaySchedule = (fromDay: number, toDay: number) => {
    const sourceDay = weeklySchedule.find((day) => day.dayOfWeek === fromDay);
    if (sourceDay) {
      setWeeklySchedule((prev) =>
        prev.map((day) => (day.dayOfWeek === toDay ? { ...day, slots: [...sourceDay.slots] } : day))
      );
    }
  };

  const setDefaultSchedule = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, slots: [...DEFAULT_SLOTS] } : day))
    );
  };

  const clearDaySchedule = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, slots: [] } : day))
    );
  };

  const saveWeeklyAvailability = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/coaches/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'weekly',
          schedule: weeklySchedule.filter((day) => day.slots.length > 0),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Disponibilités mises à jour avec succès' });
        if (onAvailabilityUpdated) {
          onAvailabilityUpdated();
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la sauvegarde' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const addSpecificSlot = () => {
    setSpecificSlots((prev) => [
      ...prev,
      { startTime: '09:00', endTime: '10:00', isAvailable: true },
    ]);
  };

  const removeSpecificSlot = (index: number) => {
    setSpecificSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSpecificSlot = (index: number, field: keyof TimeSlot, value: any) => {
    setSpecificSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

  const saveSpecificAvailability = async () => {
    if (!specificDate) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une date' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/coaches/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'specific',
          date: specificDate,
          slots: specificSlots,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Disponibilité spécifique mise à jour avec succès' });
        setSpecificDate('');
        setSpecificSlots([]);
        if (onAvailabilityUpdated) {
          onAvailabilityUpdated();
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la sauvegarde' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Chargement des disponibilités...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <Calendar className="w-5 h-5 md:w-6 md:h-6 mr-2 text-blue-600" />
            Gestion des Disponibilités
          </CardTitle>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'weekly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Planning Hebdomadaire
            </button>
            <button
              onClick={() => setActiveTab('specific')}
              className={`px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'specific'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Date Spécifique
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-center ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              )}
              <span
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {message.text}
              </span>
            </div>
          )}

          {/* Weekly Availability */}
          {activeTab === 'weekly' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:gap-6">
                {DAYS_OF_WEEK.map((day) => {
                  const daySchedule = weeklySchedule.find((d) => d.dayOfWeek === day.value);

                  return (
                    <Card key={day.value} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base md:text-lg">{day.label}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDefaultSchedule(day.value)}
                              className="text-xs"
                            >
                              Planning par défaut
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addTimeSlot(day.value)}
                              className="text-xs"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Ajouter
                            </Button>
                            {(daySchedule?.slots?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => clearDaySchedule(day.value)}
                                className="text-xs text-red-600"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Vider
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        {(daySchedule?.slots?.length ?? 0) > 0 ? (
                          <div className="grid gap-3">
                            {daySchedule?.slots?.map((slot, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <Input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) =>
                                      updateTimeSlot(day.value, index, 'startTime', e.target.value)
                                    }
                                    className="w-24 h-8 text-sm"
                                  />
                                  <span className="text-gray-400">-</span>
                                  <Input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) =>
                                      updateTimeSlot(day.value, index, 'endTime', e.target.value)
                                    }
                                    className="w-24 h-8 text-sm"
                                  />
                                </div>

                                <div className="flex items-center space-x-2">
                                  <Label className="text-xs">Disponible</Label>
                                  <Switch
                                    checked={slot.isAvailable}
                                    onCheckedChange={(checked: boolean) =>
                                      updateTimeSlot(day.value, index, 'isAvailable', checked)
                                    }
                                  />
                                </div>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeTimeSlot(day.value, index)}
                                  className="text-red-600 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            Aucun créneau défini pour ce jour
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button onClick={saveWeeklyAvailability} disabled={saving} className="px-6 md:px-8">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Specific Date Availability */}
          {activeTab === 'specific' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">
                    Disponibilité pour une date spécifique
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Définissez des créneaux pour une date particulière (remplace le planning
                    hebdomadaire pour cette date)
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="specificDate" className="text-sm md:text-base">
                      Date
                    </Label>
                    <Input
                      id="specificDate"
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1 w-fit"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm md:text-base">Créneaux horaires</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addSpecificSlot}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Ajouter un créneau
                      </Button>
                    </div>

                    {specificSlots.length > 0 ? (
                      <div className="grid gap-3">
                        {specificSlots.map((slot, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) =>
                                  updateSpecificSlot(index, 'startTime', e.target.value)
                                }
                                className="w-24 h-8 text-sm"
                              />
                              <span className="text-gray-400">-</span>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) =>
                                  updateSpecificSlot(index, 'endTime', e.target.value)
                                }
                                className="w-24 h-8 text-sm"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <Label className="text-xs">Disponible</Label>
                              <Switch
                                checked={slot.isAvailable}
                                onCheckedChange={(checked: boolean) =>
                                  updateSpecificSlot(index, 'isAvailable', checked)
                                }
                              />
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeSpecificSlot(index)}
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm">Aucun créneau défini</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={saveSpecificAvailability}
                      disabled={saving || !specificDate || specificSlots.length === 0}
                      className="px-6 md:px-8"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Sauvegarder
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
