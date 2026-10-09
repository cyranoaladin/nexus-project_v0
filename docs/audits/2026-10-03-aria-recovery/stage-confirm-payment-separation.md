# Confirmation pédagogique distincte du paiement source

4 octobre 2026. Défaut vérifié dans POST /api/stages/[stageSlug]/reservations/[reservationId]/confirm : le CAS de confirmation écrivait systématiquement paymentStatus=COMPLETED. Aucun événement prestataire ou rapprochement ne justifiait cette écriture ; une confirmation administrative pouvait remplacer un état nul, PENDING ou FAILED par un faux succès financier.

Quatre scénarios rouges reproduisent cette mutation. La correction retire uniquement cette affectation. Le statut pédagogique CONFIRMED, le rattachement Student.id, le CAS null-safe, la transaction d’activation et l’intention e-mail sont conservés. Le paiement source reste inchangé, y compris lorsqu’il était déjà COMPLETED. Admission pédagogique et paiement sont deux événements distincts ; confirmer une place ne vaut pas déclarer le règlement reçu.

L’ancien test appelait « préservation » une écriture COMPLETED : son assertion est remplacée par l’invariant plus fort d’absence de mutation financière, conformément au mandat de direction. Les assertions CAS, atomicité et usage unique restent intactes.

Preuves : quatre suites ciblées / 31 tests réussis ; PostgreSQL réel / quatre états financiers conservés après confirmation depuis richStatus NULL. 131 migrations appliquées puis replay sans migration restante. Instance tmpfs possédée arrêtée. Typecheck et ESLint ciblé réussis. Preuves locales privées ignorées : .artifacts/recovery/stage-confirm-payment-green-1791145152.

Aucune migration ou correction rétroactive de données réelles. Les anciennes confirmations éventuellement mal marquées nécessitent un rapprochement avec la source de paiement ; ne pas les « réparer » sans preuve. Le choix du destinataire d’activation reste un lot de sécurité distinct, ouvert. La CI du prochain SHA, les transitions financières complètes, le ledger et le sandbox prestataire restent à qualifier. Rollback : commit inverse, aucune down migration ou modification de production.
