import { buildWhatsAppUrl } from '@/lib/whatsapp';
export function ManualParentWhatsAppHelp() {
  return <div className="space-y-3 text-sm text-lux-on-dark-muted" role="status">
    <p>L’assistante vous accompagne pour obtenir votre lien personnel. Aucun message automatique n’a été envoyé.</p>
    <a href={buildWhatsAppUrl('Bonjour, je souhaite être accompagné pour accéder à mon espace parent.', { exactMessage: true })} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block font-medium text-lux-gold underline">Contacter l’assistante sur WhatsApp</a>
    <p>Ouvrez WhatsApp puis appuyez sur « Envoyer » pour lui transmettre votre demande.</p>
  </div>;
}
