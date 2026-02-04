"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, FileText, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentReportFormProps {
    sessionId: string;
    studentName: string;
    sessionTitle: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function StudentReportForm({
    sessionId,
    studentName,
    sessionTitle,
    onSuccess,
    onCancel
}: StudentReportFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        summary: '',
        topicsCovered: '',
        performanceRating: '3',
        attendance: true,
        engagementLevel: 'MEDIUM',
        progressNotes: '',
        recommendations: '',
        homeworkAssigned: '',
        nextSessionFocus: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(`/api/sessions/${sessionId}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la soumission du rapport');
            }

            setIsSuccess(true);
            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 2000); // Wait 2s to show success message
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900">Rapport Envoyé !</h3>
                <p className="text-gray-500">
                    Le compte-rendu a été enregistré et le parent a été notifié. La session est maintenant terminée.
                </p>
            </div>
        );
    }

    return (
        <Card className="w-full max-w-2xl mx-auto border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle>Rapport de Session</CardTitle>
                <CardDescription>
                    Remplissez le compte-rendu pour {studentName} ({sessionTitle}).
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {/* Attendance & Engagement */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="attendance">Présence de l'élève</Label>
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <Switch
                                    id="attendance"
                                    checked={formData.attendance}
                                    onCheckedChange={(checked) => handleChange('attendance', checked)}
                                />
                                <span className={formData.attendance ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                    {formData.attendance ? "Présent" : "Absent"}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="engagementLevel">Niveau d'engagement</Label>
                            <Select
                                value={formData.engagementLevel}
                                onValueChange={(value) => handleChange('engagementLevel', value)}
                            >
                                <SelectTrigger id="engagementLevel">
                                    <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Faible</SelectItem>
                                    <SelectItem value="MEDIUM">Moyen</SelectItem>
                                    <SelectItem value="HIGH">Élevé</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Performance Rating */}
                    <div className="space-y-2">
                        <Label htmlFor="performanceRating">Évaluation globale (1-5)</Label>
                        <div className="flex space-x-4">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() => handleChange('performanceRating', rating.toString())}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${formData.performanceRating === rating.toString()
                                            ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-600'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="summary">Résumé de la séance</Label>
                            <Textarea
                                id="summary"
                                placeholder="Bref résumé du déroulement de la séance..."
                                value={formData.summary}
                                onChange={(e) => handleChange('summary', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="topicsCovered">Sujets abordés</Label>
                            <Textarea
                                id="topicsCovered"
                                placeholder="Liste des notions vues (ex: Dérivées, Limites, ...)"
                                value={formData.topicsCovered}
                                onChange={(e) => handleChange('topicsCovered', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="progressNotes">Observations & Progrès</Label>
                            <Textarea
                                id="progressNotes"
                                placeholder="Points forts, difficultés rencontrées, évolution..."
                                value={formData.progressNotes}
                                onChange={(e) => handleChange('progressNotes', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Recommendations & Next Steps */}
                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-medium text-gray-900">Suite du parcours</h4>

                        <div className="space-y-2">
                            <Label htmlFor="recommendations">Recommandations</Label>
                            <Textarea
                                id="recommendations"
                                placeholder="Conseils pour l'élève..."
                                value={formData.recommendations}
                                onChange={(e) => handleChange('recommendations', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="homeworkAssigned">Devoirs donnés</Label>
                                <Input
                                    id="homeworkAssigned"
                                    placeholder="Ex: Ex 4 et 5 page 122"
                                    value={formData.homeworkAssigned}
                                    onChange={(e) => handleChange('homeworkAssigned', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nextSessionFocus">Prochaine séance</Label>
                                <Input
                                    id="nextSessionFocus"
                                    placeholder="Sujet prévu..."
                                    value={formData.nextSessionFocus}
                                    onChange={(e) => handleChange('nextSessionFocus', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6">
                        {onCancel && (
                            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                                Annuler
                            </Button>
                        )}
                        <Button type="submit" disabled={isSubmitting || !formData.summary}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Envoi...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Valider le Rapport
                                </>
                            )}
                        </Button>
                    </div>

                </form>
            </CardContent>
        </Card>
    );
}
