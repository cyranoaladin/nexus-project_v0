-- Tombstone des documents dont le fichier a disparu.
--
-- Constat empirique du 8 août 2026 : les 13 lignes user_documents référencent
-- des fichiers absents du disque — zéro correspondance, pas même par nom de
-- fichier. Les fichiers ont été perdus lors de la migration Docker vers les
-- répertoires de release. Il n'y a rien à restaurer.
--
-- La ligne est conservée (traçabilité, et localPath est @unique donc ne peut
-- pas être vidé) ; une raison d'indisponibilité est renseignée et le
-- téléchargement répond 410 Gone au lieu d'échouer obscurément.
--
-- Purement additif : colonne nullable, aucune donnée existante modifiée.

ALTER TABLE "user_documents" ADD COLUMN "unavailableReason" TEXT;
