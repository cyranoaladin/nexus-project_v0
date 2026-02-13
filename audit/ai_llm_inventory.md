# Inventaire IA/LLM/ARIA

Date: 2026-02-13T21:26:01+01:00
Total fichiers (hors node_modules/.next/coverage/.git):
6057

## Fichiers contenant des indices IA/LLM/ARIA
package.json:101:    "openai": "^4.104.0",
lib/validations.ts:75:// Validation pour les messages ARIA
lib/validations.ts:76:export const ariaMessageSchema = z.object({
lib/validations.ts:82:// Validation pour le feedback ARIA
ARCHITECTURE_TECHNIQUE.md:17:lib/                    # Auth, prisma, logique métier (credits, sessions, aria, emails)
ARCHITECTURE_TECHNIQUE.md:33:- **IA** : `AriaConversation`, `AriaMessage`, `PedagogicalContent`
ARCHITECTURE_TECHNIQUE.md:49:- **ARIA** : chat + feedback, historique en DB, RAG **textuel** (pas de vecteurs en prod).
ARCHITECTURE_TECHNIQUE.md:59:- **RAG** : recherche textuelle simple, pas de vector search.
prisma/migrations/20260201114538_init_postgres_prod/migration.sql:270:    "embedding" TEXT NOT NULL DEFAULT '[]',
e2e/premium-home.spec.ts:29:        await expect(heroSection.getByText(/IA pédagogique|IA ARIA|ARIA/i).first()).toBeVisible({ timeout: 10000 });
e2e/premium-home.spec.ts:52:        const closeButton = page.locator('#close-menu, [aria-label*="Close"], button:has-text("×")').first();
e2e/static-pages.spec.ts:11:  '/plateforme-aria',
feuille_route/Cahier des Charges Global & Technique.md:59:### 4. Architecture de l'Agent IA "ARIA"
feuille_route/Cahier des Charges Global & Technique.md:61:  *   ** Modèle :** `GPT-4` ou version supérieure d'OpenAI.
feuille_route/Cahier des Charges Global & Technique.md:62:    *   ** Architecture :** ** RAG(Retrieval - Augmented Generation) **.
feuille_route/Cahier des Charges Global & Technique.md:63:    * ARIA ne répond pas de manière générique.Ses réponses sont basées sur une ** base de données vectorielle ** (`pgvector` dans PostgreSQL) contenant nos propres contenus pédagogiques(fiches, cours, exercices).
feuille_route/Cahier des Charges Global & Technique.md:66:    *   ** Feedback Utilisateur:** Un système de notation binaire(👍/👎) doit être implémenté sur chaque réponse d'ARIA pour l'amélioration continue.
e2e/student-dashboard.spec.ts:17:    test('ARIA Chat opens', async ({ page }) => {
e2e/student-dashboard.spec.ts:21:        let chatButton = page.getByTestId('aria-chat-trigger');
e2e/student-dashboard.spec.ts:23:            chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
e2e/student-dashboard.spec.ts:29:            await expect(page.getByText(/ARIA/i).first()).toBeVisible();
e2e/student-dashboard.spec.ts:31:            console.log('⚠️  ARIA chat button not found on student dashboard');
e2e/student-dashboard.spec.ts:35:    test('Send message to ARIA', async ({ page }) => {
e2e/student-dashboard.spec.ts:38:        let chatButton = page.getByTestId('aria-chat-trigger');
e2e/student-dashboard.spec.ts:40:            chatButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
e2e/student-dashboard.spec.ts:46:            let input = page.getByTestId('aria-input');
e2e/student-dashboard.spec.ts:54:                await input.fill('Bonjour ARIA');
e2e/student-dashboard.spec.ts:58:                await expect(page.getByText('Bonjour ARIA')).toBeVisible({ timeout: 5000 });
e2e/student-dashboard.spec.ts:61:            console.log('⚠️  ARIA chat button not found');
lib/aria.ts:2:import OpenAI from 'openai';
lib/aria.ts:5:const openai = new OpenAI({
lib/aria.ts:6:  apiKey: process.env.OPENAI_API_KEY
lib/aria.ts:9:// Système de prompt pour ARIA
lib/aria.ts:10:const ARIA_SYSTEM_PROMPT = `Tu es ARIA, l'assistant IA pédagogique de Nexus Réussite, spécialisé dans l'accompagnement des lycéens du système français en Tunisie.
lib/aria.ts:28:// Recherche dans la base de connaissances (RAG)
lib/aria.ts:31:  // Plus tard, on implémentera la recherche vectorielle avec pgvector
lib/aria.ts:33:  const contents = await prisma.pedagogicalContent.findMany({
lib/aria.ts:49:// Génération de réponse ARIA
lib/aria.ts:69:    // Construction des messages pour OpenAI
lib/aria.ts:70:    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
lib/aria.ts:85:    // Appel à OpenAI
lib/aria.ts:86:    const completion = await openai.chat.completions.create({
lib/aria.ts:87:      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
lib/aria.ts:96:    console.error('Erreur ARIA:', error);
lib/aria.ts:101:// Sauvegarde d'une conversation ARIA
lib/aria.ts:102:export async function saveAriaConversation(
lib/aria.ts:112:    conversation = await prisma.ariaConversation.findUnique({
lib/aria.ts:118:    conversation = await prisma.ariaConversation.create({
lib/aria.ts:128:  await prisma.ariaMessage.create({
lib/aria.ts:136:  // Sauvegarde de la réponse ARIA
lib/aria.ts:137:  const ariaMessage = await prisma.ariaMessage.create({
lib/aria.ts:145:  return { conversation, ariaMessage };
lib/aria.ts:148:// Génération de réponse ARIA en streaming
lib/aria.ts:168:  // Construction des messages pour OpenAI
lib/aria.ts:169:  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
lib/aria.ts:184:  const stream = await openai.chat.completions.create({
lib/aria.ts:185:    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
lib/aria.ts:218:  return await prisma.ariaMessage.update({
__tests__/api/aria.feedback.route.test.ts:15:jest.mock('@/lib/aria', () => ({
__tests__/api/aria.feedback.route.test.ts:25:    ariaMessage: {
__tests__/api/aria.feedback.route.test.ts:34:import { POST } from '@/app/api/aria/feedback/route';
__tests__/api/aria.feedback.route.test.ts:38:describe('aria feedback route', () => {
__tests__/api/aria.feedback.route.test.ts:45:    const req = new Request('http://localhost/api/aria/feedback', {
__tests__/api/aria.feedback.route.test.ts:58:    (prisma.ariaMessage.findFirst as jest.Mock).mockResolvedValueOnce(null);
__tests__/api/aria.feedback.route.test.ts:60:    const req = new Request('http://localhost/api/aria/feedback', {
__tests__/api/aria.chat.route.test.ts:1:import { POST } from '@/app/api/aria/chat/route';
__tests__/api/aria.chat.route.test.ts:4:import { generateAriaResponse, saveAriaConversation } from '@/lib/aria';
__tests__/api/aria.chat.route.test.ts:15:    ariaMessage: { findMany: jest.fn() },
__tests__/api/aria.chat.route.test.ts:19:jest.mock('@/lib/aria', () => ({
__tests__/api/aria.chat.route.test.ts:21:  saveAriaConversation: jest.fn(),
__tests__/api/aria.chat.route.test.ts:46:describe('POST /api/aria/chat', () => {
__tests__/api/aria.chat.route.test.ts:92:    expect(body.error).toContain('ARIA');
__tests__/api/aria.chat.route.test.ts:107:    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValue([]);
__tests__/api/aria.chat.route.test.ts:110:    (saveAriaConversation as jest.Mock).mockResolvedValue({
__tests__/api/aria.chat.route.test.ts:112:      ariaMessage: { id: 'msg-1', createdAt: new Date('2025-01-01') },
__tests__/api/aria.conversations.route.test.ts:20:    ariaConversation: {
__tests__/api/aria.conversations.route.test.ts:26:import { GET } from '@/app/api/aria/conversations/route';
__tests__/api/aria.conversations.route.test.ts:30:describe('aria conversations route', () => {
__tests__/api/aria.conversations.route.test.ts:37:    const req = new Request('http://localhost/api/aria/conversations') as any;
__tests__/api/aria.conversations.route.test.ts:47:    const req = new Request('http://localhost/api/aria/conversations') as any;
__tests__/api/aria.conversations.route.test.ts:57:    (prisma.ariaConversation.findMany as jest.Mock).mockResolvedValueOnce([
__tests__/api/aria.conversations.route.test.ts:68:    const req = new Request('http://localhost/api/aria/conversations?subject=NSI') as any;
components/stages/HoursSchedule.tsx:73:              aria-label="Découvrir les académies"
README.md:6:Nexus Réussite est le **Nexus Digital Campus** : une **Application SaaS de Pilotage Éducatif** (LMS + back‑office) destinée à la gestion complète des parcours d’apprentissage. Le projet inclut des pages publiques, des **dashboards par rôle**, un système d’inscription « Bilan gratuit », des **abonnements & crédits**, une **réservation de sessions**, une **IA pédagogique (ARIA)**, une **visioconférence**, et des **paiements** (Konnect / Wise).
README.md:14:- **IA** : OpenAI (ARIA)
README.md:22:lib/                 # Logique métier (auth, credits, sessions, aria, emails)
README.md:48:- **ARIA** : `/api/aria/chat`, `/api/aria/feedback`
e2e/student-aria.spec.ts:8:test.describe('Student ARIA Interaction', () => {
e2e/student-aria.spec.ts:27:      const messageElements = page.locator('[data-testid="aria-message"], .aria-message, [class*="message"]');
e2e/student-aria.spec.ts:48:  test('Student can access dashboard and see ARIA section', async ({ page }) => {
e2e/student-aria.spec.ts:57:    // Check for ARIA chat button or section
e2e/student-aria.spec.ts:58:    const ariaButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
e2e/student-aria.spec.ts:60:      console.log('✅ ARIA chat button found on student dashboard');
e2e/student-aria.spec.ts:64:      // Verify ARIA interface opened
e2e/student-aria.spec.ts:65:      await expect(page.getByText(/ARIA/i).first()).toBeVisible({ timeout: 5000 });
e2e/student-aria.spec.ts:67:      console.log('⚠️ ARIA chat button not visible - may require API key configuration');
lib/analytics.ts:129:  /** Track ARIA interactions */
lib/analytics.ts:130:  ariaMessage: (message_length: number, subject?: string) =>
lib/security-headers.ts:19:        "connect-src 'self' https://api.openai.com wss:",
feuille_route/Profils_Equipe_Gamification.md:195:#### ** Catégorie : Curiosité & Interaction(ARIA) **
feuille_route/Profils_Equipe_Gamification.md:197:        *   ** Condition :** Poser la première question à ARIA.
feuille_route/Profils_Equipe_Gamification.md:199:        *   ** Condition :** Poser 25 questions à ARIA.
feuille_route/Profils_Equipe_Gamification.md:201:        *   ** Condition :** Poser 100 questions à ARIA dans une même matière.
feuille_route/Profils_Equipe_Gamification.md:203:        *   ** Condition :** Utiliser ARIA pour 3 matières différentes.
feuille_route/Profils_Equipe_Gamification.md:205:        *   ** Condition :** Donner 10 feedbacks(👍/👎) sur les réponses d'ARIA.;
__tests__/setup/test-database.ts:25:  await testPrisma.ariaMessage.deleteMany();
__tests__/setup/test-database.ts:26:  await testPrisma.ariaConversation.deleteMany();
feuille_route/Logique Metier_Business Model.md:11:1. ** L'Abonnement (Le Socle) :** L'utilisateur souscrit à une formule mensuelle qui lui donne accès à l'écosystème (plateforme, ARIA de base) et lui octroie un budget mensuel de "crédits".;
feuille_route/Logique Metier_Business Model.md:33:    * Inclus : Accès 24 / 7, Suivi, `0 crédits/mois`, ARIA(1 matière).
feuille_route/Logique Metier_Business Model.md:39:### 4. L'Offre IA "ARIA"
feuille_route/Logique Metier_Business Model.md:40:  *   ** ARIA Standard:** Inclus dans tous les abonnements.Permet l'utilisation sur **1 matière au choix**.
feuille_route/Logique Metier_Business Model.md:41:    *   ** Add - on ARIA + (Optionnel) :**
components/stages/SubjectTierTable.tsx:95:              aria-label="Réserver une consultation gratuite"
lib/constants.ts:20:      "ARIA (1 matière)",
lib/constants.ts:89:// Add-ons ARIA
lib/constants.ts:92:    name: "Matière supplémentaire ARIA",
lib/constants.ts:94:    description: "Ajoutez une matière supplémentaire à votre suivi ARIA",
lib/constants.ts:103:    name: "Analyse approfondie ARIA",
__tests__/api/student.dashboard.route.test.ts:69:      ariaConversations: [
feuille_route/Validation_Audit.md:22:*   **ARIA / RAG :** Nous sommes conscients que la recherche vectorielle est une étape ultérieure, mais l'interface doit être finalisée.
feuille_route/Validation_Audit.md:52:    *   **Action :** Créer un fichier `.env.example` à la racine du projet, listant TOUTES les variables d'environnement nécessaires, avec des valeurs vides (ex: `OPENAI_API_KEY=`). Ce fichier doit être versionné sur GitHub.
feuille_route/Validation_Audit.md:58:5.  **FINALISER l'Interface ARIA (Point Majeur de l'Audit) :**
feuille_route/Validation_Audit.md:59:    *   **Action :** Bien que le RAG complet soit une étape future, l'interface doit être 100% fonctionnelle. Intégrer les **boutons de feedback 👍👎** sur chaque réponse. Assurez-vous que l'historique des conversations est accessible et que la connexion à l'API OpenAI est bien réelle pour les utilisateurs connectés.
feuille_route/Systeme_de_Design_Exp_Utilisa.md:16:*   ** Mascotte :** Intégrer la mascotte ARIA(version brandée avec logo sur le torse et écran multi - matières) pour personnifier l'IA.
__tests__/api/student-badges.test.ts:108:          description: '25 questions ARIA',
__tests__/api/student-badges.test.ts:109:          category: 'ARIA',
__tests__/api/student-badges.test.ts:131:      category: 'ARIA',
feuille_route/Specifications-Fonctionnelles-par-Role.md:12:Accès direct à la réservation de sessions et au chat ARIA.
feuille_route/Specifications-Fonctionnelles-par-Role.md:41:La narrative autour du chat doit encourager son usage pour des questions rapides et pousser vers ARIA pour une aide instantanée.
components/stages/StickyMobileCTA.tsx:31:        aria-label="Réserver un bilan gratuit"
prisma/schema.prisma:171:  ariaConversations    AriaConversation[]
prisma/schema.prisma:231:  // Add-ons ARIA (JSON string pour SQLite)
prisma/schema.prisma:232:  ariaSubjects String @default("[]") // JSON array des matières ARIA activées
prisma/schema.prisma:233:  ariaCost     Int    @default(0) // Coût mensuel des add-ons ARIA
prisma/schema.prisma:305:// Modèle Conversation ARIA
prisma/schema.prisma:306:model AriaConversation {
prisma/schema.prisma:314:  messages AriaMessage[]
prisma/schema.prisma:323:// Modèle Message ARIA
prisma/schema.prisma:324:model AriaMessage {
prisma/schema.prisma:327:  conversation   AriaConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
prisma/schema.prisma:446:// Modèle Contenu Pédagogique (pour ARIA)
prisma/schema.prisma:447:model PedagogicalContent {
prisma/schema.prisma:455:  embedding String @default("[]") // JSON array pour vecteur d'embedding pour RAG
app/api/assistant/subscription-requests/route.ts:161:        // Add ARIA addon to active subscription (schema: Subscription.ariaSubjects/ariaCost)
docs/MIGRATION_GUIDE.md:25:// - Pas d'ARIA labels
docs/MIGRATION_GUIDE.md:42:<Button variant="default" aria-label="Action principale">
docs/MIGRATION_GUIDE.md:43:  <Icon aria-hidden="true" />
docs/MIGRATION_GUIDE.md:87:<Button onClick={handleClick} aria-label="Fermer">
docs/MIGRATION_GUIDE.md:88:  <X aria-hidden="true" />
docs/MIGRATION_GUIDE.md:281:// ✅ Après: aria-label + aria-hidden
docs/MIGRATION_GUIDE.md:286:  aria-label="Fermer le modal"
docs/MIGRATION_GUIDE.md:288:  <X className="w-5 h-5" aria-hidden="true" />
docs/MIGRATION_GUIDE.md:305:  <div role="status" aria-busy="true">
docs/MIGRATION_GUIDE.md:306:    <Loader2 className="animate-spin" aria-label="Chargement" />
docs/MIGRATION_GUIDE.md:320:  <p role="alert" aria-live="polite" className="text-error">
docs/MIGRATION_GUIDE.md:339:  aria-required="true"
docs/MIGRATION_GUIDE.md:340:  aria-invalid={hasError}
docs/MIGRATION_GUIDE.md:341:  aria-describedby={hasError ? "email-error" : undefined}
docs/MIGRATION_GUIDE.md:426:   + <Loader2 className="text-brand-primary" aria-label="Chargement" />
docs/MIGRATION_GUIDE.md:441:4. **Ajouter ARIA labels**
docs/MIGRATION_GUIDE.md:444:   + aria-hidden="true"
docs/MIGRATION_GUIDE.md:447:   + aria-label="Description de l'action"
docs/MIGRATION_GUIDE.md:450:   + role="status" aria-busy="true"
docs/MIGRATION_GUIDE.md:453:   + role="alert" aria-live="polite"
docs/MIGRATION_GUIDE.md:538:            aria-label="Chargement"
docs/MIGRATION_GUIDE.md:549:        <div role="alert" aria-live="polite" className="text-error">
docs/MIGRATION_GUIDE.md:563:          aria-label="Se déconnecter"
docs/MIGRATION_GUIDE.md:565:          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
docs/MIGRATION_GUIDE.md:625:      aria-required="true"
docs/MIGRATION_GUIDE.md:626:      aria-invalid={!!errors.email}
docs/MIGRATION_GUIDE.md:627:      aria-describedby={errors.email ? "email-error" : undefined}
docs/MIGRATION_GUIDE.md:639:        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-label="Envoi en cours" />
docs/MIGRATION_GUIDE.md:670:- [ ] **Ajouter les ARIA attributes**
docs/MIGRATION_GUIDE.md:671:  - [ ] aria-label sur icon buttons
docs/MIGRATION_GUIDE.md:672:  - [ ] aria-hidden sur icons décoratifs
docs/MIGRATION_GUIDE.md:722:### Piège 1: Oublier aria-hidden sur les icônes décoratives
docs/MIGRATION_GUIDE.md:732:  <X aria-hidden="true" /> Fermer
docs/MIGRATION_GUIDE.md:736:### Piège 2: Oublier aria-label sur les icon-only buttons
docs/MIGRATION_GUIDE.md:745:<Button size="icon" aria-label="Fermer">
docs/MIGRATION_GUIDE.md:746:  <X aria-hidden="true" />
docs/MIGRATION_GUIDE.md:768:  <div role="alert" aria-live="polite" className="text-error">
docs/MIGRATION_GUIDE.md:852:   - Added ARIA labels to all interactive elements"
__tests__/api/subscriptions.aria-addon.route.test.ts:1:import { POST } from '@/app/api/subscriptions/aria-addon/route';
__tests__/api/subscriptions.aria-addon.route.test.ts:21:describe('POST /api/subscriptions/aria-addon', () => {
__tests__/database/schema.test.ts:164:    describe('Student → AriaConversation cascade', () => {
__tests__/database/schema.test.ts:165:      it('should cascade delete AriaConversation when Student is deleted', async () => {
__tests__/database/schema.test.ts:169:        const conversation = await prisma.ariaConversation.create({
__tests__/database/schema.test.ts:179:        const conversationAfterDelete = await prisma.ariaConversation.findUnique({
__tests__/database/schema.test.ts:446:    it('should have composite index on AriaConversation(studentId, updatedAt)', async () => {
__tests__/database/schema.test.ts:457:    it('should have composite index on AriaMessage(conversationId, createdAt)', async () => {
components/stages/StagesHero.tsx:67:              aria-label="Réserver une consultation gratuite"
components/stages/StagesHero.tsx:75:              aria-label="Découvrir les académies"
e2e/parent-dashboard.spec.ts:64:    await page.waitForSelector('[data-testid="loading"], [aria-busy="true"]', {
e2e/parent-dashboard.spec.ts:751:        '[data-testid="loading"], [aria-busy="true"], [class*="loading"], [class*="spinner"]'
e2e/parent-dashboard.spec.ts:777:      const skeletons = page.locator('[class*="skeleton"], [aria-busy="true"]');
lib/badges.ts:79:  // Catégorie : Curiosité & Interaction (ARIA)
lib/badges.ts:82:    description: 'Poser la première question à ARIA',
lib/badges.ts:89:    description: 'Poser 25 questions à ARIA',
lib/badges.ts:96:    description: 'Poser 100 questions à ARIA dans une matière',
lib/badges.ts:103:    description: 'Utiliser ARIA pour 3 matières différentes',
lib/badges.ts:110:    description: 'Donner 10 feedbacks sur ARIA',
lib/badges.ts:177:      const feedbackCount = await prisma.ariaMessage.count({
lib/badges.ts:193:      const questionCount = await prisma.ariaMessage.count({
__tests__/components/navigation-item.test.tsx:21:    expect(link).toHaveAttribute('aria-current', 'page');
__tests__/components/navigation-item.test.tsx:33:    expect(link).toHaveAttribute('aria-current', 'page');
__tests__/components/navigation-item.test.tsx:45:    expect(link).not.toHaveAttribute('aria-current');
app/api/student/dashboard/route.ts:52:        ariaConversations: {
app/api/student/dashboard/route.ts:104:    // Get recent ARIA messages count
app/api/student/dashboard/route.ts:107:    const ariaMessagesToday = student.ariaConversations.reduce((count: number, conversation) => {
app/api/student/dashboard/route.ts:160:        messagesToday: ariaMessagesToday,
app/api/student/dashboard/route.ts:161:        totalConversations: student.ariaConversations.length
e2e/stages-fevrier2026.spec.ts:71:    const answer = page.locator('[data-state="open"], [aria-expanded="true"], .accordion-content:visible, details[open]').first();
lib/rate-limit.ts:31:    // Moderate rate limit for AI/ARIA endpoints
components/stages/AcademyGrid.tsx:189:                    aria-label="Réserver une consultation gratuite"
components/stages/AcademyGrid.tsx:196:                    aria-label="Voir les questions fréquentes"
components/stages/FAQAccordion.tsx:49:                  aria-expanded={openIndex === index}
components/stages/FAQAccordion.tsx:50:                  aria-controls={`faq-answer-${index}`}
components/stages/FAQAccordion.tsx:75:              aria-label="Réserver une consultation gratuite"
app/api/aria/conversations/route.ts:62:    const conversations = await prisma.ariaConversation.findMany({
app/api/aria/conversations/route.ts:73:    logger.info('ARIA conversations retrieved', {
app/api/aria/conversations/route.ts:103:    logger.error('Erreur récupération conversations ARIA:', error)
app/auth/signin/page.tsx:76:              <LogIn className="w-8 h-8 text-brand-accent" aria-hidden="true" />
app/auth/signin/page.tsx:155:                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
app/auth/signin/page.tsx:158:                          <EyeOff className="w-5 h-5" aria-hidden="true" />
app/auth/signin/page.tsx:160:                          <Eye className="w-5 h-5" aria-hidden="true" />
app/auth/signin/page.tsx:184:                        <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-label="Chargement" />
app/auth/signin/page.tsx:189:                        <LogIn className="w-5 h-5 mr-2" aria-hidden="true" />
lib/translations.ts:7:        part2: "& de l'Intelligence Agentique."
lib/translations.ts:9:      description: "Nos spécialistes conçoivent vos solutions de demain, de la gouvernance scolaire aux smart contracts. Nexus Réussite unifie Conseil Stratégique et Ingénierie de Pointe (RAG & Web3) pour bâtir l'avenir de l'éducation.",
lib/translations.ts:16:      studio: "Studio RAG",
lib/translations.ts:53:        description: "Un studio de développement intégré. Nous concevons vos plateformes SaaS, pipelines RAG et applications décentralisées (dApps).",
lib/translations.ts:55:          agentic: {
lib/translations.ts:56:            title: "Orchestration Agentique",
lib/translations.ts:57:            desc: "Déploiement d'agents autonomes pour le tutorat."
lib/translations.ts:59:          rag: {
lib/translations.ts:60:            title: "Pipelines RAG",
lib/translations.ts:77:      description: "Nos solutions ne se contentent pas de répondre. Elles comprennent, analysent et guident. Grâce à nos architectures RAG (Retrieval-Augmented Generation), vos données deviennent une intelligence active.",
lib/translations.ts:108:      tagline: "Un pôle d'expertises pluridisciplinaires unifiant le meilleur de chaque monde : Ingénierie Pédagogique, Intelligence Artificielle Agentique (RAG), Déploiement Web3 & Blockchain, et Plateformes de Formation (LMS/Labs).",
lib/translations.ts:122:          studio: "Studio RAG & IA",
lib/translations.ts:150:        part2: "& Agentic Intelligence."
lib/translations.ts:152:      description: "Our specialists design your future solutions, from school governance to smart contracts. Nexus Réussite unifies Strategic Consulting and Advanced Engineering (RAG & Web3) to build the future of education.",
lib/translations.ts:159:      studio: "Studio RAG",
lib/translations.ts:196:        description: "An integrated development studio. We design your SaaS platforms, RAG pipelines, and decentralized applications (dApps).",
lib/translations.ts:198:          agentic: {
lib/translations.ts:199:            title: "Agentic Orchestration",
lib/translations.ts:200:            desc: "Deployment of autonomous agents for tutoring."
lib/translations.ts:202:          rag: {
lib/translations.ts:203:            title: "RAG Pipelines",
lib/translations.ts:220:      description: "Our solutions don't just answer. They understand, analyze, and guide. Thanks to our RAG (Retrieval-Augmented Generation) architectures, your data becomes active intelligence.",
lib/translations.ts:251:      tagline: "A multidisciplinary hub of expertise unifying the best of both worlds: Instructional Engineering, Agentic AI (RAG), Web3 & Blockchain Deployment, and Learning Platforms (LMS/Labs).",
lib/translations.ts:265:          studio: "Studio RAG & AI",
components/stages/Timeline.tsx:54:              aria-label="Réserver une consultation gratuite"
e2e/fixtures/README.md:57:- Nov 2025: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
e2e/fixtures/README.md:58:- Dec 2025: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
e2e/fixtures/README.md:59:- Jan 2026: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
e2e/fixtures/README.md:126:- Multiple transaction types (SUBSCRIPTION, CREDIT_PACK, ARIA add-ons)
app/api/aria/feedback/route.ts:8:import { recordAriaFeedback } from '@/lib/aria'
app/api/aria/feedback/route.ts:12:// Schema de validation pour le feedback ARIA
app/api/aria/feedback/route.ts:46:    logger.info('ARIA feedback submission', {
app/api/aria/feedback/route.ts:53:    const message = await prisma.ariaMessage.findFirst({
app/api/aria/feedback/route.ts:65:      logger.warn('ARIA feedback for non-existent message', {
app/api/aria/feedback/route.ts:90:      logger.info('ARIA feedback recorded', {
app/api/aria/feedback/route.ts:114:    logger.error('Erreur feedback ARIA:', error)
app/sitemap.ts:53:      url: `${BASE_URL}/plateforme-aria`,
lib/aria-streaming.ts:2:import OpenAI from 'openai';
lib/aria-streaming.ts:5:const openai = new OpenAI({
lib/aria-streaming.ts:6:  apiKey: process.env.OPENAI_API_KEY
lib/aria-streaming.ts:9:const ARIA_SYSTEM_PROMPT = `Tu es ARIA, l'assistant IA pédagogique de Nexus Réussite, spécialisé dans l'accompagnement des lycéens du système français en Tunisie.
lib/aria-streaming.ts:28:  const contents = await prisma.pedagogicalContent.findMany({
lib/aria-streaming.ts:60:  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
lib/aria-streaming.ts:75:  const stream = await openai.chat.completions.create({
lib/aria-streaming.ts:76:    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
app/(dashboard)/student/error.tsx:25:            <AlertCircle className="h-6 w-6" aria-hidden="true" />
app/(dashboard)/student/error.tsx:50:              aria-label="Réessayer de charger"
app/(dashboard)/student/error.tsx:52:              <RefreshCw className="h-4 w-4" aria-hidden="true" />
app/(dashboard)/student/error.tsx:59:                aria-label="Retour à l'accueil"
app/(dashboard)/student/error.tsx:61:                <Home className="h-4 w-4" aria-hidden="true" />
__tests__/components/ui/checkbox.test.tsx:11:    render(<Checkbox aria-label="Accept terms" />);
__tests__/components/ui/checkbox.test.tsx:21:      <Checkbox aria-label="Accept terms" checked={false} onCheckedChange={onCheckedChange} />
__tests__/components/ui/checkbox.test.tsx:28:      <Checkbox aria-label="Accept terms" checked onCheckedChange={onCheckedChange} />
__tests__/components/ui/checkbox.test.tsx:36:    render(<Checkbox aria-label="Accept terms" onCheckedChange={onCheckedChange} />);
__tests__/components/ui/checkbox.test.tsx:46:    render(<Checkbox aria-label="Accept terms" disabled onCheckedChange={onCheckedChange} />);
__tests__/components/ui/checkbox.test.tsx:57:    render(<Checkbox aria-label="Accept terms" />);
__tests__/components/ui/toast.test.tsx:164:    it('has proper ARIA attributes', () => {
__tests__/components/ui/switch.test.tsx:11:    render(<Switch aria-label="Enable notifications" />);
__tests__/components/ui/switch.test.tsx:19:    render(<Switch aria-label="Enable notifications" defaultChecked />);
__tests__/components/ui/switch.test.tsx:27:    render(<Switch aria-label="Enable notifications" />);
__tests__/components/ui/switch.test.tsx:39:    render(<Switch aria-label="Enable notifications" disabled />);
__tests__/components/ui/switch.test.tsx:50:    render(<Switch aria-label="Enable notifications" />);
__tests__/components/ui/dialog.test.tsx:205:    it('associates title with dialog via aria-labelledby', () => {
__tests__/components/ui/dialog.test.tsx:211:      const labelledBy = dialog.getAttribute('aria-labelledby');
__tests__/components/ui/dialog.test.tsx:216:    it('associates description with dialog via aria-describedby', () => {
__tests__/components/ui/dialog.test.tsx:222:      const describedBy = dialog.getAttribute('aria-describedby');
__tests__/components/ui/dialog.test.tsx:246:    it('trigger has proper ARIA attributes when dialog is closed', () => {
__tests__/components/ui/dialog.test.tsx:250:      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
__tests__/components/ui/dialog.test.tsx:251:      expect(trigger).toHaveAttribute('aria-expanded', 'false');
__tests__/components/ui/dialog.test.tsx:254:    it('trigger has proper ARIA attributes when dialog is open', () => {
__tests__/components/ui/dialog.test.tsx:258:      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
__tests__/components/ui/dialog.test.tsx:259:      expect(trigger).toHaveAttribute('aria-expanded', 'true');
__tests__/components/ui/dialog.test.tsx:409:            <input type="text" placeholder="Name" aria-label="Name" />
__tests__/components/ui/dialog.test.tsx:410:            <input type="email" placeholder="Email" aria-label="Email" />
app/api/aria/chat/route.ts:7:import { AriaMessage } from '@prisma/client'
app/api/aria/chat/route.ts:10:import { generateAriaResponse, saveAriaConversation } from '@/lib/aria'
app/api/aria/chat/route.ts:11:import { generateAriaResponseStream } from '@/lib/aria-streaming'
app/api/aria/chat/route.ts:15:// Schema de validation pour les messages ARIA
app/api/aria/chat/route.ts:16:const ariaMessageSchema = z.object({
app/api/aria/chat/route.ts:50:    const validatedData = ariaMessageSchema.parse(body)
app/api/aria/chat/route.ts:71:    // Vérifier l'accès à ARIA pour cette matière
app/api/aria/chat/route.ts:87:        { error: 'Accès ARIA non autorisé pour cette matière' },
app/api/aria/chat/route.ts:96:      const messages = await prisma.ariaMessage.findMany({
app/api/aria/chat/route.ts:102:      conversationHistory = messages.map((msg: AriaMessage) => ({
app/api/aria/chat/route.ts:108:    logger.info('ARIA chat request', {
app/api/aria/chat/route.ts:164:            const { conversation, ariaMessage } = await saveAriaConversation(
app/api/aria/chat/route.ts:176:            logger.info('ARIA streaming response completed', {
app/api/aria/chat/route.ts:178:              messageId: ariaMessage.id,
app/api/aria/chat/route.ts:190:                id: ariaMessage.id,
app/api/aria/chat/route.ts:191:                createdAt: ariaMessage.createdAt
app/api/aria/chat/route.ts:231:    const { conversation, ariaMessage } = await saveAriaConversation(
app/api/aria/chat/route.ts:242:    logger.info('ARIA response generated', {
app/api/aria/chat/route.ts:244:      messageId: ariaMessage.id,
app/api/aria/chat/route.ts:261:        id: ariaMessage.id,
app/api/aria/chat/route.ts:263:        createdAt: ariaMessage.createdAt
app/api/aria/chat/route.ts:273:    logger.error('Erreur chat ARIA:', error)
e2e/auth-and-booking.spec.ts:463:      const ariaBusy = await submitButton.getAttribute('aria-busy');
app/api/subscriptions/aria-addon/route.ts:32:        { error: 'Add-on ARIA invalide' },
app/api/subscriptions/aria-addon/route.ts:78:      message: 'Add-on ARIA prêt pour le paiement'
app/api/subscriptions/aria-addon/route.ts:82:    console.error('Erreur add-on ARIA:', error)
__tests__/components/ui/breadcrumb.test.tsx:40:    expect(current).toHaveAttribute('aria-current', 'page');
app/(dashboard)/student/page.tsx:7:import { AriaEmbeddedChat } from '@/components/ui/aria-embedded-chat';
app/(dashboard)/student/page.tsx:121:        aria-label="Se déconnecter"
app/(dashboard)/student/page.tsx:123:        <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
app/(dashboard)/student/page.tsx:147:                <User className="w-8 h-8 text-brand-accent" aria-hidden="true" />
app/(dashboard)/student/page.tsx:176:          <Card role="region" aria-label="Solde de crédits" className="bg-surface-card border border-white/10 shadow-premium">
app/(dashboard)/student/page.tsx:179:              <CreditCard className="h-4 w-4 text-brand-accent" aria-hidden="true" />
app/(dashboard)/student/page.tsx:182:              <div className="text-xl sm:text-2xl font-bold text-brand-accent" aria-label={`${data.credits.balance} crédits disponibles`}>
app/(dashboard)/student/page.tsx:205:                                <TrendingUp className="h-3 w-3 text-emerald-300 flex-shrink-0" aria-hidden="true" />
app/(dashboard)/student/page.tsx:207:                                <TrendingDown className="h-3 w-3 text-rose-300 flex-shrink-0" aria-hidden="true" />
app/(dashboard)/student/page.tsx:242:          <Card role="region" aria-label="Prochaine session" className="bg-surface-card border border-white/10 shadow-premium">
app/(dashboard)/student/page.tsx:245:              <Calendar className="h-4 w-4 text-emerald-300" aria-hidden="true" />
app/(dashboard)/student/page.tsx:277:          <Card role="region" aria-label="Progression et badges" className="bg-surface-card border border-white/10 shadow-premium">
app/(dashboard)/student/page.tsx:280:              <Award className="h-4 w-4 text-purple-300" aria-hidden="true" />
app/(dashboard)/student/page.tsx:297:            {/* ARIA Chat Component */}
app/(dashboard)/student/page.tsx:313:            <Card role="region" aria-label="Sessions récentes" className="bg-surface-card border border-white/10 shadow-premium">
app/(dashboard)/student/page.tsx:317:                    <Calendar className="w-5 h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/(dashboard)/student/page.tsx:323:                    aria-label="Voir toutes les sessions"
app/(dashboard)/student/page.tsx:326:                    <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
app/(dashboard)/student/page.tsx:338:                        aria-label={`Session ${session.title} - ${session.subject}`}
app/(dashboard)/student/page.tsx:384:                    <Calendar className="w-12 h-12 text-neutral-500 mx-auto mb-3" aria-hidden="true" />
app/(dashboard)/student/page.tsx:389:                      <Button className="btn-outline" size="sm" aria-label="Réserver une session">
e2e/fixtures/parent.json:203:      "description": "Première question posée à ARIA",
e2e/fixtures/parent.json:206:      "condition": "Ask first question to ARIA"
e2e/fixtures/parent.json:211:      "description": "10 conversations ARIA",
e2e/fixtures/parent.json:214:      "condition": "Complete 10 ARIA conversations"
e2e/fixtures/parent.json:219:      "description": "50 questions posées à ARIA",
e2e/fixtures/parent.json:222:      "condition": "Ask 50 questions to ARIA"
e2e/fixtures/parent.json:1276:      "description": "Add-on ARIA - 3 matières - Yasmine (Novembre 2025)",
e2e/fixtures/parent.json:1287:      "description": "Add-on ARIA - 2 matières - Karim (Novembre 2025)",
e2e/fixtures/parent.json:1320:      "description": "Add-on ARIA - 3 matières - Yasmine (Décembre 2025)",
e2e/fixtures/parent.json:1331:      "description": "Add-on ARIA - 2 matières - Karim (Décembre 2025)",
e2e/fixtures/parent.json:1364:      "description": "Add-on ARIA - 3 matières - Yasmine (Janvier 2026)",
e2e/fixtures/parent.json:1375:      "description": "Add-on ARIA - 2 matières - Karim (Janvier 2026)",
app/famille/page.tsx:28:      "ARIA et les coachs ont fait la différence. Le planning et les progrès étaient visibles chaque semaine.",
app/plateforme-aria/layout.tsx:4:  title: 'Plateforme ARIA | Nexus Réussite - IA pédagogique 24/7',
app/plateforme-aria/layout.tsx:5:  description: 'Découvrez ARIA, l\'assistant IA pédagogique de Nexus Réussite. Aide aux devoirs, révisions, préparation examen 24/7 pour lycéens du système français.',
app/plateforme-aria/page.tsx:13:import { AriaChat } from "@/components/ui/aria-chat";
components/stages/TierCards.tsx:84:              aria-label="Découvrir les académies"
app/notre-centre/page.tsx:88:                  title: "Lab IA ARIA",
__tests__/components/ui/button.test.tsx:188:    it('has aria-busy="true" when loading', () => {
__tests__/components/ui/button.test.tsx:192:      expect(button).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/button.test.tsx:195:    it('has aria-busy="false" when not loading', () => {
__tests__/components/ui/button.test.tsx:199:      expect(button).toHaveAttribute('aria-busy', 'false');
__tests__/components/ui/button.test.tsx:259:    it('has aria-hidden on loading spinner icon', () => {
__tests__/components/ui/button.test.tsx:263:      expect(loader).toHaveAttribute('aria-hidden', 'true');
__tests__/components/ui/button.test.tsx:373:      expect(button).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/button.test.tsx:379:      expect(button).toHaveAttribute('aria-busy', 'false');
__tests__/components/ui/button.test.tsx:532:    it('applies aria-busy to child when asChild and loading', () => {
__tests__/components/ui/button.test.tsx:540:      expect(link).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/button.test.tsx:624:        expect(button).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/radio-group.test.tsx:13:        <RadioGroupItem value="basic" aria-label="Basic" />
__tests__/components/ui/radio-group.test.tsx:14:        <RadioGroupItem value="pro" aria-label="Pro" />
__tests__/components/ui/radio-group.test.tsx:26:        <RadioGroupItem value="basic" aria-label="Basic" />
__tests__/components/ui/radio-group.test.tsx:27:        <RadioGroupItem value="pro" aria-label="Pro" />
__tests__/components/ui/radio-group.test.tsx:39:        <RadioGroupItem value="basic" aria-label="Basic" />
__tests__/components/ui/radio-group.test.tsx:40:        <RadioGroupItem value="pro" aria-label="Pro" />
__tests__/components/ui/radio-group.test.tsx:54:        <RadioGroupItem value="basic" aria-label="Basic" />
__tests__/components/ui/radio-group.test.tsx:55:        <RadioGroupItem value="pro" aria-label="Pro" disabled />
__tests__/components/ui/radio-group.test.tsx:70:        <RadioGroupItem value="basic" aria-label="Basic" />
__tests__/components/ui/radio-group.test.tsx:71:        <RadioGroupItem value="pro" aria-label="Pro" />
__tests__/components/ui/input.test.tsx:74:      expect(requiredIndicator).toHaveAttribute('aria-label', 'required');
__tests__/components/ui/input.test.tsx:137:    it('sets aria-invalid to true when error is present', () => {
__tests__/components/ui/input.test.tsx:141:      expect(input).toHaveAttribute('aria-invalid', 'true');
__tests__/components/ui/input.test.tsx:144:    it('sets aria-invalid to false when no error', () => {
__tests__/components/ui/input.test.tsx:148:      expect(input).toHaveAttribute('aria-invalid', 'false');
__tests__/components/ui/input.test.tsx:151:    it('sets aria-required when required prop is true', () => {
__tests__/components/ui/input.test.tsx:155:      expect(input).toHaveAttribute('aria-required', 'true');
__tests__/components/ui/input.test.tsx:158:    it('does not set aria-required when not required', () => {
__tests__/components/ui/input.test.tsx:162:      expect(input).not.toHaveAttribute('aria-required');
__tests__/components/ui/input.test.tsx:165:    it('associates error message with input via aria-describedby', () => {
__tests__/components/ui/input.test.tsx:171:      const describedBy = input.getAttribute('aria-describedby');
__tests__/components/ui/input.test.tsx:176:    it('associates helper text with input via aria-describedby', () => {
__tests__/components/ui/input.test.tsx:182:      const describedBy = input.getAttribute('aria-describedby');
__tests__/components/ui/input.test.tsx:187:    it('prioritizes error over helper text in aria-describedby', () => {
__tests__/components/ui/input.test.tsx:199:      const describedBy = input.getAttribute('aria-describedby');
__tests__/components/ui/input.test.tsx:498:      expect(input).toHaveAttribute('aria-invalid', 'false');
__tests__/components/ui/input.test.tsx:505:      expect(input).toHaveAttribute('aria-invalid', 'false');
__tests__/components/ui/input.test.tsx:539:      expect(input).toHaveAttribute('aria-invalid', 'false');
__tests__/components/ui/input.test.tsx:546:      expect(input).toHaveAttribute('aria-required', 'true');
__tests__/components/ui/tabs.test.tsx:123:    it('has proper ARIA attributes on tabs', () => {
__tests__/components/ui/skeleton.test.tsx:258:    it('has default aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:262:      expect(button).toHaveAttribute('aria-label', 'Loading button');
__tests__/components/ui/skeleton.test.tsx:265:    it('can override aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:266:      const { container } = render(<SkeletonButton aria-label="Custom loading" />);
__tests__/components/ui/skeleton.test.tsx:269:      expect(button).toHaveAttribute('aria-label', 'Custom loading');
__tests__/components/ui/skeleton.test.tsx:300:    it('has default aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:304:      expect(input).toHaveAttribute('aria-label', 'Loading input');
__tests__/components/ui/skeleton.test.tsx:307:    it('can override aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:308:      const { container } = render(<SkeletonInput aria-label="Custom loading" />);
__tests__/components/ui/skeleton.test.tsx:311:      expect(input).toHaveAttribute('aria-label', 'Custom loading');
__tests__/components/ui/skeleton.test.tsx:416:    it('combines aria attributes with custom props on new patterns', () => {
__tests__/components/ui/skeleton.test.tsx:419:          aria-label="Custom loading"
__tests__/components/ui/skeleton.test.tsx:420:          aria-live="polite"
__tests__/components/ui/skeleton.test.tsx:427:      expect(button).toHaveAttribute('aria-label', 'Custom loading');
__tests__/components/ui/skeleton.test.tsx:428:      expect(button).toHaveAttribute('aria-live', 'polite');
__tests__/components/ui/skeleton.test.tsx:468:    it('has aria-busy="true" by default', () => {
__tests__/components/ui/skeleton.test.tsx:472:      expect(skeleton).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/skeleton.test.tsx:475:    it('has aria-busy on all skeleton patterns', () => {
__tests__/components/ui/skeleton.test.tsx:486:      const skeletons = container.querySelectorAll('[aria-busy="true"]');
__tests__/components/ui/skeleton.test.tsx:490:    it('can have aria-label for loading state', () => {
__tests__/components/ui/skeleton.test.tsx:492:        <Skeleton aria-label="Loading content" />
__tests__/components/ui/skeleton.test.tsx:496:      expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
__tests__/components/ui/skeleton.test.tsx:499:    it('supports aria-live="polite"', () => {
__tests__/components/ui/skeleton.test.tsx:501:        <Skeleton aria-live="polite" />
__tests__/components/ui/skeleton.test.tsx:505:      expect(skeleton).toHaveAttribute('aria-live', 'polite');
__tests__/components/ui/skeleton.test.tsx:508:    it('supports aria-live="assertive"', () => {
__tests__/components/ui/skeleton.test.tsx:510:        <Skeleton aria-live="assertive" />
__tests__/components/ui/skeleton.test.tsx:514:      expect(skeleton).toHaveAttribute('aria-live', 'assertive');
__tests__/components/ui/skeleton.test.tsx:517:    it('supports aria-live="off"', () => {
__tests__/components/ui/skeleton.test.tsx:519:        <Skeleton aria-live="off" />
__tests__/components/ui/skeleton.test.tsx:523:      expect(skeleton).toHaveAttribute('aria-live', 'off');
__tests__/components/ui/skeleton.test.tsx:526:    it('can combine aria-label and aria-live', () => {
__tests__/components/ui/skeleton.test.tsx:528:        <Skeleton aria-label="Loading profile" aria-live="polite" />
__tests__/components/ui/skeleton.test.tsx:532:      expect(skeleton).toHaveAttribute('aria-label', 'Loading profile');
__tests__/components/ui/skeleton.test.tsx:533:      expect(skeleton).toHaveAttribute('aria-live', 'polite');
__tests__/components/ui/skeleton.test.tsx:534:      expect(skeleton).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/skeleton.test.tsx:546:    it('SkeletonButton has appropriate aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:550:      expect(button).toHaveAttribute('aria-label', 'Loading button');
__tests__/components/ui/skeleton.test.tsx:551:      expect(button).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/skeleton.test.tsx:554:    it('SkeletonInput has appropriate aria-label', () => {
__tests__/components/ui/skeleton.test.tsx:558:      expect(input).toHaveAttribute('aria-label', 'Loading input');
__tests__/components/ui/skeleton.test.tsx:559:      expect(input).toHaveAttribute('aria-busy', 'true');
__tests__/components/ui/skeleton.test.tsx:625:      const skeletons = container.querySelectorAll('[aria-busy="true"]');
app/robots.ts:9:        userAgent: '*',
__tests__/lib/analytics.test.ts:212:    it('track.ariaMessage sends aria_message event', () => {
__tests__/lib/analytics.test.ts:213:      track.ariaMessage(150, 'MATHEMATIQUES');
__tests__/lib/validations.extra.test.ts:3:  ariaMessageSchema,
__tests__/lib/validations.extra.test.ts:54:  it('aria message and feedback schemas validate', () => {
__tests__/lib/validations.extra.test.ts:56:      ariaMessageSchema.parse({ subject: 'NSI', content: 'Bonjour' })
app/page.tsx:65:          <p>Coachs agrégés + IA pédagogique ARIA 24/7 + Dashboard parent en temps réel. Le seul programme qui s'engage sur les résultats de votre enfant au Baccalauréat.</p>
components/stages/UrgencyBanner.tsx:26:          aria-label="Réserver une consultation gratuite"
__tests__/components/parent/badge-display.test.tsx:231:    test('should have proper ARIA labels for badge icons', () => {
app/api/parent/subscription-requests/route.ts:93:          message: `Nouvelle demande de ${requestType === 'PLAN_CHANGE' ? 'changement de formule' : 'service ARIA+'} pour ${student.user.firstName} ${student.user.lastName}`,
__tests__/lib/validations.test.ts:3:  ariaMessageSchema,
__tests__/lib/validations.test.ts:187:  describe('ariaMessageSchema', () => {
__tests__/lib/validations.test.ts:194:      const result = ariaMessageSchema.safeParse(validData);
__tests__/lib/validations.test.ts:203:      const result = ariaMessageSchema.safeParse(invalidData);
__tests__/lib/validations.test.ts:216:      const result = ariaMessageSchema.safeParse(invalidData);
__tests__/lib/badges.test.ts:12:    ariaMessage: {
__tests__/lib/badges.test.ts:48:  it('checkAndAwardBadges handles aria feedback threshold', async () => {
__tests__/lib/badges.test.ts:52:    (prisma.ariaMessage.count as jest.Mock).mockResolvedValue(10);
__tests__/lib/aria.test.ts:3:  { choices: [{ delta: { content: ' ARIA' } }] },
__tests__/lib/aria.test.ts:11:jest.mock('openai', () => ({
__tests__/lib/aria.test.ts:13:  default: class FakeOpenAI {
__tests__/lib/aria.test.ts:25:          return { choices: [{ message: { content: 'Réponse ARIA' } }] };
__tests__/lib/aria.test.ts:35:    pedagogicalContent: { findMany: jest.fn() },
__tests__/lib/aria.test.ts:36:    ariaConversation: {
__tests__/lib/aria.test.ts:40:    ariaMessage: {
__tests__/lib/aria.test.ts:51:  saveAriaConversation,
__tests__/lib/aria.test.ts:52:} from '@/lib/aria';
__tests__/lib/aria.test.ts:67:describe('aria', () => {
__tests__/lib/aria.test.ts:72:  it('generates ARIA response', async () => {
__tests__/lib/aria.test.ts:73:    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);
__tests__/lib/aria.test.ts:79:    expect(result).toBe('Réponse ARIA');
__tests__/lib/aria.test.ts:83:    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);
__tests__/lib/aria.test.ts:95:    expect(output).toContain('Salut ARIA');
__tests__/lib/aria.test.ts:96:    expect(onComplete).toHaveBeenCalledWith('Salut ARIA');
__tests__/lib/aria.test.ts:100:    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);
__tests__/lib/aria.test.ts:101:    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1' });
__tests__/lib/aria.test.ts:102:    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-2' });
__tests__/lib/aria.test.ts:104:    const result = await saveAriaConversation(
__tests__/lib/aria.test.ts:111:    expect(prisma.ariaMessage.create).toHaveBeenCalledTimes(2);
__tests__/lib/aria.test.ts:116:    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1' });
__tests__/lib/constants.test.ts:14:  it('defines ARIA add-ons', () => {
__tests__/lib/aria-streaming.test.ts:12:jest.mock('openai', () => ({
__tests__/lib/aria-streaming.test.ts:14:  default: class FakeOpenAI {
__tests__/lib/aria-streaming.test.ts:30:    pedagogicalContent: { findMany: jest.fn() },
__tests__/lib/aria-streaming.test.ts:34:import { generateAriaResponseStream } from '@/lib/aria-streaming';
__tests__/lib/aria-streaming.test.ts:49:describe('aria streaming', () => {
__tests__/lib/aria-streaming.test.ts:55:    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([
app/studio/page.tsx:23:                            Ne vous contentez pas d'utiliser l'IA. Construisez vos propres Agents Autonomes et systèmes RAG.
app/studio/page.tsx:38:                            <h3 className="text-xl font-bold mb-3 text-white">RAG Enterprise</h3>
app/studio/page.tsx:48:                            <h3 className="text-xl font-bold mb-3 text-white">Agents Autonomes</h3>
app/studio/page.tsx:50:                                Déploiement d'équipes d'agents (CrewAI, LangGraph) pour automatiser vos tâches complexes.
app/studio/page.tsx:59:                                Analyse de performance et conformité de vos modèles LLM.
app/studio/page.tsx:78:                                    Un diagnostic rapide et un plan d'action pour vos agents et RAG.
app/accompagnement-scolaire/layout.tsx:5:  description: "Accompagnement scolaire nouvelle génération: coaching humain d'excellence + intelligence artificielle ARIA. Suivi personnalisé 7j/7, garantie résultats. À partir de 299 TND/mois.",
app/accompagnement-scolaire/layout.tsx:6:  keywords: ["accompagnement scolaire", "cours particuliers", "soutien scolaire premium", "coaching scolaire", "IA éducation", "ARIA", "Tunisie"],
app/accompagnement-scolaire/layout.tsx:9:    description: "Excellence pédagogique augmentée par l'IA. Coaching humain + assistant ARIA disponible 24/7. Résultats garantis.",
app/api/parent/subscriptions/route.ts:70:        ariaSubjects: [] // Placeholder for ARIA subjects
app/dashboard/eleve/page.tsx:13:import { AriaWidget } from "@/components/ui/aria-widget";
app/dashboard/eleve/page.tsx:97:        data-testid="aria-chat-trigger"
app/dashboard/eleve/page.tsx:98:        aria-label="Ouvrir ARIA"
app/dashboard/eleve/page.tsx:100:        ARIA
app/dashboard/eleve/page.tsx:144:          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
app/dashboard/eleve/page.tsx:156:          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" aria-label="Erreur" />
app/dashboard/eleve/page.tsx:179:                <User className="w-8 h-8 text-brand-accent" aria-hidden="true" />
app/dashboard/eleve/page.tsx:205:                aria-label="Ouvrir ARIA"
app/dashboard/eleve/page.tsx:207:                ARIA
app/dashboard/eleve/page.tsx:213:                aria-label="Se déconnecter"
app/dashboard/eleve/page.tsx:215:                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
app/dashboard/eleve/page.tsx:243:                  <CreditCard className="h-4 w-4 text-brand-accent" aria-hidden="true" />
app/dashboard/eleve/page.tsx:259:                  <Calendar className="h-4 w-4 text-emerald-300" aria-hidden="true" />
docs/DESIGN_SYSTEM.md:284:| **Tabs** | `ui/tabs.tsx` | Keyboard navigation, ARIA compliant | 2026-02-01 |
docs/DESIGN_SYSTEM.md:450:- ✅ **ARIA Labels**: `aria-label`, `aria-hidden`, `role` sur tous les composants
docs/DESIGN_SYSTEM.md:453:### Attributs ARIA Standards
docs/DESIGN_SYSTEM.md:457:<button aria-label="Fermer">
docs/DESIGN_SYSTEM.md:458:  <X aria-hidden="true" />
docs/DESIGN_SYSTEM.md:462:<div role="status" aria-busy="true">
docs/DESIGN_SYSTEM.md:463:  <Loader2 aria-label="Chargement" />
docs/DESIGN_SYSTEM.md:468:<p role="alert" aria-live="polite" className="text-error">
docs/DESIGN_SYSTEM.md:477:  aria-required="true"
docs/DESIGN_SYSTEM.md:478:  aria-invalid={hasError}
docs/DESIGN_SYSTEM.md:479:  aria-describedby={hasError ? "email-error" : undefined}
docs/DESIGN_SYSTEM.md:635:- [ ] Ajouter `aria-label` sur icon buttons
docs/DESIGN_SYSTEM.md:636:- [ ] Ajouter `aria-hidden` sur decorative icons
docs/DESIGN_SYSTEM.md:782:- ✅ ARIA labels ajoutés
__tests__/middleware/rate-limit-integration.test.ts:3: * Verifies rate limiting works correctly for ARIA and Auth endpoints
__tests__/middleware/rate-limit-integration.test.ts:31:  describe('ARIA Chat Endpoint - Expensive Preset (10/min)', () => {
__tests__/middleware/rate-limit-integration.test.ts:32:    const testPath = '/api/aria/chat';
__tests__/middleware/rate-limit-integration.test.ts:37:      clearRateLimit(cleanupRequest, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:44:      const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:54:        const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:59:      const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:70:        RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:74:      const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:99:        RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:102:      const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:123:        const result = RateLimitPresets.expensive(request1, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:128:      const result1 = RateLimitPresets.expensive(request1, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:133:      const result2 = RateLimitPresets.expensive(request2, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:137:      clearRateLimit(request2, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:141:  describe('ARIA Feedback Endpoint - API Preset (100/min)', () => {
__tests__/middleware/rate-limit-integration.test.ts:142:    const testPath = '/api/aria/feedback';
__tests__/middleware/rate-limit-integration.test.ts:147:      clearRateLimit(cleanupRequest, 'aria:feedback');
__tests__/middleware/rate-limit-integration.test.ts:155:        const result = RateLimitPresets.api(request, 'aria:feedback');
__tests__/middleware/rate-limit-integration.test.ts:160:      const result = RateLimitPresets.api(request, 'aria:feedback');
__tests__/middleware/rate-limit-integration.test.ts:169:        const result = RateLimitPresets.api(request, 'aria:feedback');
__tests__/middleware/rate-limit-integration.test.ts:174:      const result = RateLimitPresets.api(request, 'aria:feedback');
__tests__/middleware/rate-limit-integration.test.ts:290:      const testPath = '/api/aria/chat';
__tests__/middleware/rate-limit-integration.test.ts:328:      const testPath = '/api/aria/chat';
__tests__/middleware/rate-limit-integration.test.ts:332:      const result = RateLimitPresets.expensive(request, 'aria:chat');
__tests__/middleware/rate-limit-integration.test.ts:338:      clearRateLimit(request, 'aria:chat');
__tests__/middleware/pino-logger.test.ts:43:      'user-agent': 'test-agent',
__tests__/middleware/pino-logger.test.ts:219:      const request = createMockRequest('/api/aria/chat');
__tests__/e2e/homepage-audit.spec.ts:111:      'header button[aria-label="Toggle menu"]',
__tests__/e2e/homepage-audit.spec.ts:112:      'header button[aria-label*="Menu"]',
app/dashboard/assistante/subscription-requests/page.tsx:131:      case 'ARIA_ADDON': return 'Ajout ARIA+';
components/layout/CorporateFooter.tsx:21:        { label: 'Plateforme ARIA', href: '/plateforme-aria', isPage: true },
docs/FINAL_AUDIT_REPORT.md:56:- All components include ARIA attributes for accessibility
docs/FINAL_AUDIT_REPORT.md:88:- Added `aria-label` to all icon-only buttons
docs/FINAL_AUDIT_REPORT.md:89:- Added `aria-live` regions for dynamic content
docs/FINAL_AUDIT_REPORT.md:90:- Added `aria-busy` states for loading indicators
docs/FINAL_AUDIT_REPORT.md:91:- Added `aria-hidden="true"` to decorative icons
docs/FINAL_AUDIT_REPORT.md:114:- Added ARIA labels to all interactive elements in navigation
docs/FINAL_AUDIT_REPORT.md:135:              micro-engagement-section, aria-widget)
docs/FINAL_AUDIT_REPORT.md:259:| **ARIA Labels** | Inconsistent | **100%** on migrated pages | ✅ Complete |
docs/FINAL_AUDIT_REPORT.md:415:  - components/widgets/aria-widget.tsx
docs/FINAL_AUDIT_REPORT.md:493:5. ✅ **4.1.2 Name, Role, Value**: Proper ARIA attributes on all components
docs/FINAL_AUDIT_REPORT.md:497:**ARIA Labels**:
docs/FINAL_AUDIT_REPORT.md:500:<Button variant="ghost" size="icon" aria-label="Close dialog">
docs/FINAL_AUDIT_REPORT.md:505:<Loader2 className="w-8 h-8 animate-spin" aria-label="Chargement" />
docs/FINAL_AUDIT_REPORT.md:508:<CheckCircle className="w-5 h-5 text-success" aria-hidden="true" />
docs/FINAL_AUDIT_REPORT.md:514:<p role="alert" aria-live="polite" className="text-error">
docs/FINAL_AUDIT_REPORT.md:519:<div role="status" aria-busy={isLoading}>
docs/FINAL_AUDIT_REPORT.md:552:1. `feat(admin): migrate dashboard to design tokens with ARIA`
docs/FINAL_AUDIT_REPORT.md:598:components/widgets/aria-widget.tsx
docs/FINAL_AUDIT_REPORT.md:795:   - ARIA attributes added proactively
docs/FINAL_AUDIT_REPORT.md:958:components/widgets/aria-widget.tsx (.btn-primary)
docs/FINAL_AUDIT_REPORT.md:1017:<X /> → <X aria-hidden="true" />
docs/FINAL_AUDIT_REPORT.md:1018:<button onClick={close}> → <Button aria-label="Close">
docs/FINAL_AUDIT_REPORT.md:1019:{isLoading && <Loader2 />} → <Loader2 aria-label="Loading" />
components/layout/CorporateNavbar.tsx:94:        { label: 'Plateforme ARIA', href: '/plateforme-aria', isPage: true },
components/layout/CorporateNavbar.tsx:157:                    aria-expanded={isOpenGroup}
components/layout/CorporateNavbar.tsx:158:                    aria-haspopup="menu"
components/layout/CorporateNavbar.tsx:163:                      aria-hidden="true"
components/layout/CorporateNavbar.tsx:197:              aria-label="Démarrer un bilan gratuit"
components/layout/CorporateNavbar.tsx:199:              <Phone className="w-4 h-4" aria-hidden="true" />
components/layout/CorporateNavbar.tsx:208:              aria-label="Ouvrir le menu"
components/layout/CorporateNavbar.tsx:209:              aria-expanded={isOpen}
components/layout/CorporateNavbar.tsx:210:              aria-controls="primary-menu"
components/layout/CorporateNavbar.tsx:213:              <Menu className="w-6 h-6" aria-hidden="true" />
components/layout/CorporateNavbar.tsx:242:                aria-label="Fermer le menu"
components/layout/CorporateNavbar.tsx:244:                <X className="w-8 h-8" aria-hidden="true" />
components/layout/CorporateNavbar.tsx:266:                                aria-current={pathname === item.href ? "page" : undefined}
components/layout/CorporateNavbar.tsx:279:                                  aria-hidden="true"
components/layout/CorporateNavbar.tsx:296:                                <span className="absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
components/layout/CorporateNavbar.tsx:346:                <Phone className="w-4 h-4 text-brand-accent" aria-hidden="true" />
docs/MIDDLEWARE.md:333:   - Use log shipping agent or direct API integration
app/dashboard/coach/page.tsx:121:          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
app/dashboard/coach/page.tsx:132:          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" aria-label="Erreur" />
app/dashboard/coach/page.tsx:154:                <BookOpen className="w-8 h-8 text-brand-accent" aria-hidden="true" />
app/dashboard/coach/page.tsx:179:              aria-label="Se déconnecter"
app/dashboard/coach/page.tsx:181:              <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
app/dashboard/coach/page.tsx:216:                  <Calendar className="h-4 w-4 text-brand-accent" aria-hidden="true" />
app/dashboard/coach/page.tsx:264:              <Clock className="h-4 w-4 text-emerald-300" aria-hidden="true" />
app/dashboard/coach/page.tsx:279:              <Users className="h-4 w-4 text-purple-300" aria-hidden="true" />
app/dashboard/coach/page.tsx:298:                <Calendar className="w-5 h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/dashboard/coach/page.tsx:345:                  <Calendar className="w-16 h-16 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
app/dashboard/coach/page.tsx:361:                <Users className="w-5 h-5 mr-2 text-emerald-300" aria-hidden="true" />
app/dashboard/coach/page.tsx:407:                  <Users className="w-16 h-16 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
app/dashboard/coach/page.tsx:432:                    <Calendar className="w-6 h-6 text-brand-accent" aria-hidden="true" />
app/dashboard/coach/page.tsx:436:                    <MessageCircle className="w-6 h-6 text-purple-300" aria-hidden="true" />
app/dashboard/coach/page.tsx:440:                    <BookOpen className="w-6 h-6 text-emerald-300" aria-hidden="true" />
__tests__/components/sections/pillars-section.test.tsx:88:    expect(screen.getByAltText(/ARIA - Notre Intelligence Artificielle/i)).toBeInTheDocument();
__tests__/components/sections/pillars-section.test.tsx:98:    expect(screen.getByText(/IA ARIA/)).toBeInTheDocument();
app/offres/layout.tsx:5:  description: "Découvrez nos formules d'accompagnement scolaire: Programme Excellence (299 TND/mois), Pack Bac Garanti (1990 TND/an). Coaching personnalisé avec IA ARIA.",
app/accompagnement-scolaire/page.tsx:86:                <div className="text-sm text-gray-400">Support IA ARIA</div>
app/accompagnement-scolaire/page.tsx:155:                      <strong className="text-white">IA ARIA Premium</strong>{" "}
app/accompagnement-scolaire/page.tsx:265:                        IA ARIA Premium illimitée
app/accompagnement-scolaire/page.tsx:438:                  sur le dashboard parent, et support IA ARIA 24/7.
app/accompagnement-scolaire/page.tsx:483:                IA ARIA 24/7
__tests__/components/sections/hero-section.test.tsx:66:    expect(screen.getByText(/plateforme intelligente ARIA/i)).toBeInTheDocument();
__tests__/components/sections/hero-section.test.tsx:97:    expect(screen.getByText(/IA ARIA/i)).toBeInTheDocument();
app/layout.tsx:60:    description: 'Plateforme de pilotage éducatif combinant coachs agrégés, IA pédagogique ARIA et dashboard parent en temps réel pour la réussite au Baccalauréat.',
app/dashboard/admin/page.tsx:112:          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
app/dashboard/admin/page.tsx:139:                <Shield className="w-6 h-6 md:w-8 md:h-8 text-rose-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:152:              aria-label="Se déconnecter"
app/dashboard/admin/page.tsx:154:              <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
app/dashboard/admin/page.tsx:179:                <Users className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/dashboard/admin/page.tsx:224:              <CreditCard className="h-4 w-4 text-emerald-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:239:              <Activity className="h-4 w-4 text-purple-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:257:              <Activity className="h-4 w-4 text-brand-accent" aria-hidden="true" />
app/dashboard/admin/page.tsx:272:              <Database className="h-4 w-4 text-indigo-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:287:              <CreditCard className="h-4 w-4 text-amber-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:306:                <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/dashboard/admin/page.tsx:315:                      <TestTube className="w-4 h-4 md:w-5 md:h-5 text-rose-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:327:                      <Users className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" aria-hidden="true" />
app/dashboard/admin/page.tsx:339:                      <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:351:                      <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:367:                <Activity className="w-4 h-4 md:w-5 md:h-5 mr-2 text-emerald-300" aria-hidden="true" />
app/dashboard/admin/page.tsx:377:                        {activity.type === 'session' && <Activity className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" aria-hidden="true" />}
app/dashboard/admin/page.tsx:378:                        {activity.type === 'user' && <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />}
app/dashboard/admin/page.tsx:379:                        {activity.type === 'subscription' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-purple-300" aria-hidden="true" />}
app/dashboard/admin/page.tsx:380:                        {activity.type === 'credit' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-amber-300" aria-hidden="true" />}
app/dashboard/admin/page.tsx:424:                  <Activity className="w-12 h-12 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
app/equipe/page.tsx:882:                  <li>📊 Dashboard + IA ARIA 24/7</li>
app/equipe/page.tsx:911:                    <li>✅ Accès ARIA 7 jours gratuit</li>
app/equipe/page.tsx:939:                      💬 Demander conseil à ARIA
components/ui/diagnostic-form.tsx:282:                  <div className="space-y-6" aria-live="polite">
components/ui/diagnostic-form.tsx:304:                  <div className="flex flex-wrap gap-3 mt-6" role="group" aria-label="Liens de recommandation">
components/ui/diagnostic-form.tsx:305:                    <Link href={recommendation.parcoursLink} aria-label="Découvrir ce parcours">
components/ui/diagnostic-form.tsx:312:                      <Link href={recommendation.academieLink} aria-label="Voir cette académie">
components/ui/tabs.tsx:5: * Provides keyboard navigation and ARIA attributes
components/ui/modal.tsx:94:                                            aria-label="Fermer"
components/ui/button-enhanced.tsx:66:                aria-busy={loading}
components/ui/button-enhanced.tsx:67:                aria-disabled={isDisabled}
components/ui/button-enhanced.tsx:77:                        <Loader2 className="w-5 h-5 animate-spin" aria-label="Chargement" />
app/bilan-gratuit/confirmation/page.tsx:30:              <CheckCircle className="w-10 h-10 text-green-600" aria-hidden="true" />
app/bilan-gratuit/confirmation/page.tsx:63:                    <Clock className="w-6 h-6 text-primary-600" aria-hidden="true" />
app/bilan-gratuit/confirmation/page.tsx:75:                    <Phone className="w-6 h-6 text-secondary-600" aria-hidden="true" />
app/bilan-gratuit/confirmation/page.tsx:87:                    <CheckCircle className="w-6 h-6 text-green-600" aria-hidden="true" />
app/bilan-gratuit/confirmation/page.tsx:105:                <Mail className="w-5 h-5 text-brand-primary mt-1" aria-hidden="true" />
app/bilan-gratuit/confirmation/page.tsx:128:                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
app/mentions-legales/page.tsx:62:                                    La fourniture de solutions logicielles (SaaS, RAG Pipelines, Smart Contracts) est régie par les Conditions Générales de Vente (CGV) spécifiques aux produits numériques. Nexus Réussite garantit la conformité du code livré aux spécifications fonctionnelles validées.
app/mentions-legales/page.tsx:82:                                L'ensemble des éléments graphiques, logiciels, codes sources (notamment les agents IA et les contrats intelligents non open-source) et contenus éditoriaux présents sur le site sont la propriété exclusive de Nexus Réussite.
components/ui/input-validated.tsx:52:                        {props.required && <span className="text-error ml-1" aria-label="requis">*</span>}
components/ui/input-validated.tsx:71:                        aria-invalid={hasError}
components/ui/input-validated.tsx:72:                        aria-describedby={
components/ui/input-validated.tsx:85:                            <AlertCircle className="w-5 h-5 text-error" aria-hidden="true" />
components/ui/error-boundary.tsx:48:              <AlertCircle className="h-5 w-5" aria-hidden="true" />
components/ui/error-boundary.tsx:72:              aria-label="Réessayer"
components/ui/error-boundary.tsx:74:              <RefreshCw className="h-4 w-4" aria-hidden="true" />
components/ui/session-report-form.tsx:127:          aria-required="true"
components/ui/session-report-form.tsx:128:          aria-invalid={!!errors.summary}
components/ui/session-report-form.tsx:129:          aria-describedby={errors.summary ? "summary-error" : undefined}
components/ui/session-report-form.tsx:147:          aria-required="true"
components/ui/session-report-form.tsx:148:          aria-invalid={!!errors.topicsCovered}
components/ui/session-report-form.tsx:149:          aria-describedby={errors.topicsCovered ? "topics-error" : undefined}
components/ui/session-report-form.tsx:164:          aria-required="true"
components/ui/session-report-form.tsx:165:          aria-invalid={!!errors.performanceRating}
components/ui/session-report-form.tsx:166:          aria-describedby={errors.performanceRating ? "rating-error" : undefined}
components/ui/session-report-form.tsx:187:                aria-hidden="true"
components/ui/session-report-form.tsx:209:          aria-required="true"
components/ui/session-report-form.tsx:210:          aria-invalid={!!errors.progressNotes}
components/ui/session-report-form.tsx:211:          aria-describedby={errors.progressNotes ? "progress-error" : undefined}
components/ui/session-report-form.tsx:229:          aria-required="true"
components/ui/session-report-form.tsx:230:          aria-invalid={!!errors.recommendations}
components/ui/session-report-form.tsx:231:          aria-describedby={errors.recommendations ? "recommendations-error" : undefined}
components/ui/session-report-form.tsx:253:          aria-required="true"
components/ui/session-report-form.tsx:254:          aria-label="Présence de l'élève"
components/ui/session-report-form.tsx:264:          <SelectTrigger id="engagementLevel" aria-label="Niveau d'engagement">
app/dashboard/parent/abonnements/page.tsx:346:            {/* Add-ons ARIA */}
app/dashboard/parent/abonnements/page.tsx:351:                  Add-ons ARIA
components/ui/parent/progress-chart.tsx:140:              <SelectTrigger className="w-[140px] h-10" aria-label="Type de graphique">
components/ui/parent/progress-chart.tsx:151:                <SelectTrigger className="w-[120px] h-10" aria-label="Période d'affichage">
components/ui/parent/progress-chart.tsx:170:            <div role="img" aria-label="Graphique d'évolution de la progression au fil du temps">
components/ui/parent/progress-chart.tsx:218:            <div role="img" aria-label="Graphique de progression par matière">
components/ui/input.tsx:41:          aria-invalid={hasError}
components/ui/input.tsx:42:          aria-describedby={
components/ui/input.tsx:45:          aria-required={props.required}
components/ui/input.tsx:65:            {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
app/dashboard/parent/aria-addon-dialog.tsx:52:      alert("Veuillez sélectionner un service ARIA+");
app/dashboard/parent/aria-addon-dialog.tsx:89:      console.error('Error requesting ARIA addon:', error);
app/dashboard/parent/aria-addon-dialog.tsx:101:          Ajouter ARIA+
app/dashboard/parent/aria-addon-dialog.tsx:108:            Ajouter un Service ARIA+
app/dashboard/parent/aria-addon-dialog.tsx:111:            Demande d'ajout de service ARIA+ pour {studentName}
app/dashboard/parent/aria-addon-dialog.tsx:116:            <Label htmlFor="addonType" className="text-neutral-200">Service ARIA+ *</Label>
app/dashboard/parent/aria-addon-dialog.tsx:149:                <p className="font-medium mb-1">Service ARIA+ :</p>
components/ui/session-calendar.tsx:134:      <Card className={cn("w-full", className)} role="region" aria-label="Calendrier des sessions">
components/ui/session-calendar.tsx:138:              <Calendar className="h-5 w-5" aria-hidden="true" />
components/ui/session-calendar.tsx:145:              aria-label="Réserver une session"
components/ui/session-calendar.tsx:147:              <Plus className="h-4 w-4" aria-hidden="true" />
components/ui/session-calendar.tsx:184:                  day_button: "rdp-day_button h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md",
components/ui/session-calendar.tsx:190:                aria-label="Calendrier de sélection de date"
components/ui/session-calendar.tsx:224:                            <User className="h-3 w-3" aria-hidden="true" />
components/ui/session-calendar.tsx:229:                          <Clock className="h-3 w-3" aria-hidden="true" />
components/ui/session-calendar.tsx:241:                          aria-label={`Rejoindre la session ${session.title}`}
components/ui/session-calendar.tsx:243:                          <Video className="h-3 w-3 mr-1" aria-hidden="true" />
components/ui/back-to-top.tsx:41:      aria-label="Retour en haut"
components/ui/button.tsx:53:          aria-busy={loading}
components/ui/button.tsx:69:        aria-busy={loading}
components/ui/button.tsx:77:          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
components/ui/breadcrumb.tsx:18:    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-2 text-sm", className)}>
components/ui/breadcrumb.tsx:28:                  aria-hidden="true"
components/ui/breadcrumb.tsx:34:                  aria-current="page"
components/ui/parent/financial-history.tsx:219:              <Button variant="ghost" size="sm" onClick={clearFilters} aria-label="Réinitialiser tous les filtres">
components/ui/parent/financial-history.tsx:229:              aria-label="Exporter l'historique en format CSV"
components/ui/parent/financial-history.tsx:241:            <SelectTrigger className="h-10" aria-label="Filtrer par type de transaction">
components/ui/parent/financial-history.tsx:256:              <SelectTrigger className="h-10" aria-label="Filtrer par enfant">
components/ui/parent/financial-history.tsx:271:            <SelectTrigger className="h-10" aria-label="Filtrer par statut">
components/ui/parent/financial-history.tsx:290:            aria-label="Date de début"
components/ui/parent/financial-history.tsx:299:            aria-label="Date de fin"
components/ui/parent/financial-history.tsx:320:              <Table role="table" aria-label="Historique des transactions financières">
components/ui/parent/financial-history.tsx:327:                      aria-sort={sortField === "date" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
components/ui/parent/financial-history.tsx:338:                      aria-sort={sortField === "type" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
components/ui/parent/financial-history.tsx:350:                      aria-sort={sortField === "amount" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
components/ui/parent/financial-history.tsx:361:                      aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
components/ui/parent/financial-history.tsx:373:                        aria-sort={sortField === "child" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
components/ui/parent/financial-history.tsx:443:                  aria-label={`Charger plus de transactions, ${sortedTransactions.length - displayedCount} restantes`}
components/ui/testimonials-section.tsx:13:    content: "Grâce à Nexus Réussite, j'ai obtenu une mention Très Bien avec 18/20 en Maths et 17/20 en Physique. Le suivi personnalisé et l'IA ARIA ont fait toute la différence.",
components/ui/testimonials-section.tsx:36:    program: "ARIA+ Premium",
components/ui/testimonials-section.tsx:37:    content: "L'IA ARIA est révolutionnaire. Mon fils peut réviser 24/7 et obtenir des explications instantanées. Son niveau en Maths a considérablement progressé.",
components/ui/faq-section.tsx:15:    question: "L'IA ARIA peut-elle remplacer un professeur ?",
components/ui/faq-section.tsx:16:    answer: "Non, ARIA est un outil complémentaire qui aide à la révision 24/7, mais ne remplace pas l'expertise humaine. Nos professeurs agrégés et certifiés restent au cœur de notre pédagogie pour l'accompagnement personnalisé et les cours en présentiel."
components/ui/parent/badge-display.tsx:73:          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6" aria-label="Filtrer les badges par catégorie">
components/ui/parent/badge-display.tsx:74:            <TabsTrigger value="all" className="text-xs sm:text-sm" aria-label={`Tous les badges, ${categoryCounts.all} badges`}>
components/ui/parent/badge-display.tsx:77:            <TabsTrigger value="ASSIDUITE" className="text-xs sm:text-sm" aria-label={`Badges d'assiduité, ${categoryCounts.ASSIDUITE} badges`}>
components/ui/parent/badge-display.tsx:80:            <TabsTrigger value="PROGRESSION" className="text-xs sm:text-sm" aria-label={`Badges de progression, ${categoryCounts.PROGRESSION} badges`}>
components/ui/parent/badge-display.tsx:83:            <TabsTrigger value="CURIOSITE" className="text-xs sm:text-sm" aria-label={`Badges de curiosité, ${categoryCounts.CURIOSITE} badges`}>
components/ui/parent/badge-display.tsx:131:                          <div className="text-4xl mb-3" role="img" aria-label={badge.name}>
components/ui/aria-widget.tsx:20:      content: `Bonjour ! Je suis ARIA, votre assistant IA pédagogique. ${initialPrompt ? `Parlons de : "${initialPrompt}"` : 'Comment puis-je vous aider aujourd\'hui ?'}`
components/ui/aria-widget.tsx:36:    // Simuler une réponse ARIA (en production, appel API réel)
components/ui/aria-widget.tsx:83:                  src="/images/aria.png"
components/ui/aria-widget.tsx:84:                  alt="ARIA"
components/ui/aria-widget.tsx:92:                <h3 className="font-semibold">ARIA</h3>
components/ui/aria-widget.tsx:117:                      <span className="text-xs font-medium text-blue-600">ARIA</span>
components/ui/aria-widget.tsx:163:                  aria-label="Votre message"
components/ui/aria-widget.tsx:164:                  data-testid="aria-input"
app/offres/page.tsx:71:    title: "ARIA+ Premium Seul",
app/offres/page.tsx:96:    nexus: "24/7 avec IA ARIA",
app/offres/page.tsx:389:                  text: "Coachs + IA ARIA + reporting parent.",
app/offres/page.tsx:449:                    "IA ARIA (1 matière)",
app/offres/page.tsx:495:                    "IA ARIA (1 matière)",
app/offres/page.tsx:542:                    "IA ARIA (1 matière)",
app/offres/page.tsx:560:            {/* Add-on ARIA */}
app/offres/page.tsx:563:                <strong className="text-brand-accent">ARIA+</strong> : ajoutez des matières à votre IA pédagogique.
app/offres/page.tsx:678:              *Calcul basé sur la formule Hybride : 450 TND/mois pour 4h = 112 TND/h tout inclus (coach agrégé + IA ARIA + dashboard + suivi).
app/offres/page.tsx:860:                    quote: "L'IA ARIA nous a permis de réviser sans stress. Les progrès sont visibles chaque semaine.",
app/offres/page.tsx:988:                  q: "Comment fonctionne l'IA ARIA ?",
app/offres/page.tsx:989:                  a: "ARIA est une assistante pédagogique basée sur GPT-4, disponible 24/7. Elle aide votre enfant pour les révisions, les exercices, et la préparation aux examens. Elle est incluse dans tous les abonnements (1 matière). Matières supplémentaires en add-on."
components/ui/aria-comparison.tsx:11:  aria: boolean | string;
components/ui/aria-comparison.tsx:16:  { feature: "Aide aux devoirs 24/7", aria: true, ariaPlus: true },
components/ui/aria-comparison.tsx:17:  { feature: "Explications personnalisées", aria: true, ariaPlus: true },
components/ui/aria-comparison.tsx:18:  { feature: "Correction d'exercices", aria: true, ariaPlus: true },
components/ui/aria-comparison.tsx:19:  { feature: "Matières disponibles", aria: "1 au choix", ariaPlus: "Toutes disponibles" },
components/ui/aria-comparison.tsx:20:  { feature: "Suivi de progression", aria: false, ariaPlus: true },
components/ui/aria-comparison.tsx:21:  { feature: "Dashboard personnalisé", aria: false, ariaPlus: true },
components/ui/aria-comparison.tsx:22:  { feature: "Simulateur d'oral", aria: false, ariaPlus: true },
components/ui/aria-comparison.tsx:23:  { feature: "Analyses de textes", aria: false, ariaPlus: true },
components/ui/aria-comparison.tsx:24:  { feature: "Préparation aux examens", aria: "Basique", ariaPlus: "Avancée" },
components/ui/aria-comparison.tsx:25:  { feature: "Support prioritaire", aria: false, ariaPlus: true }
components/ui/aria-comparison.tsx:44:            Passez à la Vitesse Supérieure avec ARIA+
components/ui/aria-comparison.tsx:53:            {/* ARIA Essentiel */}
components/ui/aria-comparison.tsx:66:                    ARIA Essentiel
components/ui/aria-comparison.tsx:83:            {/* ARIA+ Premium */}
components/ui/aria-comparison.tsx:99:                    ARIA+ Premium
components/ui/aria-comparison.tsx:132:                    Pourquoi choisir ARIA+ ?
components/ui/aria-comparison.tsx:169:                          ARIA Essentiel
components/ui/aria-comparison.tsx:172:                          ARIA+ Premium
components/ui/aria-comparison.tsx:183:                            {typeof feature.aria === 'boolean' ? (
components/ui/aria-comparison.tsx:184:                              feature.aria ? (
components/ui/aria-comparison.tsx:191:                                {feature.aria}
components/ui/aria-comparison.tsx:230:              Activer ARIA+ Premium
components/ui/aria-chat.tsx:51:      // TODO: Vérifier les droits ARIA de l'élève
components/ui/aria-chat.tsx:78:      const response = await fetch('/api/aria/chat', {
components/ui/aria-chat.tsx:92:        const ariaMessageId = Date.now().toString();
components/ui/aria-chat.tsx:93:        const ariaMessage: Message = {
components/ui/aria-chat.tsx:94:          id: ariaMessageId,
components/ui/aria-chat.tsx:100:        setMessages(prev => [...prev, ariaMessage]);
components/ui/aria-chat.tsx:114:              msg.id === ariaMessageId
components/ui/aria-chat.tsx:126:        throw new Error(result.error || 'Erreur lors de la communication avec ARIA');
components/ui/aria-chat.tsx:129:      console.error('Erreur ARIA:', error)
components/ui/aria-chat.tsx:156:        ? "Bonjour ! Je suis ARIA, votre assistant IA pédagogique. Pour accéder à toutes mes fonctionnalités et bénéficier d'un suivi personnalisé, connectez-vous à votre compte Nexus Réussite."
components/ui/aria-chat.tsx:159:      const ariaMessage: Message = {
components/ui/aria-chat.tsx:166:      setMessages(prev => [...prev, ariaMessage])
components/ui/aria-chat.tsx:175:      await fetch('/api/aria/feedback', {
components/ui/aria-chat.tsx:227:              src="/images/aria.png"
components/ui/aria-chat.tsx:228:              alt="ARIA"
components/ui/aria-chat.tsx:234:              <p className="text-sm font-medium text-gray-900">ARIA</p>
components/ui/aria-chat.tsx:257:                      src="/images/aria.png"
components/ui/aria-chat.tsx:258:                      alt="ARIA"
components/ui/aria-chat.tsx:264:                      <CardTitle className="text-xl font-bold">ARIA</CardTitle>
components/ui/aria-chat.tsx:285:                        src="/images/aria.png"
components/ui/aria-chat.tsx:286:                        alt="ARIA"
components/ui/aria-chat.tsx:292:                        Bonjour ! Je suis ARIA 👋
components/ui/aria-chat.tsx:306:                        src="/images/aria.png"
components/ui/aria-chat.tsx:307:                        alt="ARIA"
components/ui/aria-chat.tsx:316:                        Je suis ARIA, votre assistant IA personnel.<br />
components/ui/aria-chat.tsx:340:                        {/* Feedback pour les réponses ARIA */}
components/ui/aria-feedback.tsx:38:      const response = await fetch('/api/aria/feedback', {
components/ui/aria-feedback.tsx:86:            Cette réponse d'ARIA vous a-t-elle été utile ?
components/ui/aria-feedback.tsx:179:// Composant pour afficher un message ARIA avec feedback intégré
components/ui/aria-feedback.tsx:180:interface AriaMessageWithFeedbackProps {
components/ui/aria-feedback.tsx:195:export function AriaMessageWithFeedback({
components/ui/aria-feedback.tsx:199:}: AriaMessageWithFeedbackProps) {
components/ui/aria-feedback.tsx:225:      {/* Feedback pour les messages d'ARIA uniquement */}
components/ui/skeleton.tsx:32:   * Custom aria-label for accessibility
components/ui/skeleton.tsx:34:  "aria-label"?: string
components/ui/skeleton.tsx:36:   * ARIA live region politeness setting
components/ui/skeleton.tsx:38:  "aria-live"?: "off" | "polite" | "assertive"
components/ui/skeleton.tsx:42:  ({ className, animation = "pulse", "aria-label": ariaLabel, "aria-live": ariaLive, ...props }, ref) => {
components/ui/skeleton.tsx:58:        aria-busy="true"
components/ui/skeleton.tsx:59:        aria-label={ariaLabel}
components/ui/skeleton.tsx:60:        aria-live={ariaLive}
components/ui/skeleton.tsx:146:    aria-label="Loading button"
components/ui/skeleton.tsx:162:    aria-label="Loading input"
components/ui/aria-embedded-chat.tsx:60:      const response = await fetch(`/api/aria/conversations?subject=${selectedSubject}`)
components/ui/aria-embedded-chat.tsx:127:      const response = await fetch('/api/aria/chat', {
components/ui/aria-embedded-chat.tsx:224:      await fetch('/api/aria/feedback', {
components/ui/aria-embedded-chat.tsx:251:    <Card className="h-full flex flex-col" role="region" aria-label="Assistant ARIA">
components/ui/aria-embedded-chat.tsx:254:          <Bot className="w-6 h-6" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:255:          ARIA - Assistant IA
components/ui/aria-embedded-chat.tsx:272:            <SelectTrigger id="subject-select" className="w-full" aria-label="Sélectionner une matière">
components/ui/aria-embedded-chat.tsx:288:          aria-live="polite"
components/ui/aria-embedded-chat.tsx:289:          aria-label="Historique de conversation"
components/ui/aria-embedded-chat.tsx:293:              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:306:                data-testid="aria-message"
components/ui/aria-embedded-chat.tsx:308:                aria-label={message.role === 'user' ? 'Votre message' : 'Réponse ARIA'}
components/ui/aria-embedded-chat.tsx:317:                    <Bot className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:322:                      <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse" aria-label="En cours de réception" />
components/ui/aria-embedded-chat.tsx:337:                      aria-label="Utile"
components/ui/aria-embedded-chat.tsx:338:                      aria-pressed={message.feedback === true}
components/ui/aria-embedded-chat.tsx:339:                      aria-describedby={`feedback-label-${message.id}`}
components/ui/aria-embedded-chat.tsx:341:                      <ThumbsUp className="w-3 h-3" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:348:                      aria-label="Pas utile"
components/ui/aria-embedded-chat.tsx:349:                      aria-pressed={message.feedback === false}
components/ui/aria-embedded-chat.tsx:350:                      aria-describedby={`feedback-label-${message.id}`}
components/ui/aria-embedded-chat.tsx:352:                      <ThumbsDown className="w-3 h-3" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:366:                aria-label="Chargement de la réponse"
components/ui/aria-embedded-chat.tsx:369:                  <Bot className="w-5 h-5 text-blue-600" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:371:                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:372:                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:373:                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:387:            aria-live="assertive"
components/ui/aria-embedded-chat.tsx:409:              aria-label="Votre question"
components/ui/aria-embedded-chat.tsx:418:              aria-label="Envoyer le message"
components/ui/aria-embedded-chat.tsx:421:                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
components/ui/aria-embedded-chat.tsx:423:                <Send className="w-4 h-4" aria-hidden="true" />
app/bilan-gratuit/page.tsx:236:              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
app/bilan-gratuit/page.tsx:280:                    <User className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/bilan-gratuit/page.tsx:386:                    <GraduationCap className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
app/bilan-gratuit/page.tsx:425:                      <Select aria-label="Niveau" aria-labelledby="studentGradeLabel" value={formData.studentGrade} onValueChange={(value) => handleInputChange('studentGrade', value)}>
app/bilan-gratuit/page.tsx:457:                      <Select aria-label="Niveau actuel" aria-labelledby="currentLevelLabel" value={formData.currentLevel} onValueChange={(value) => handleInputChange('currentLevel', value)}>
app/bilan-gratuit/page.tsx:475:                      <Select aria-label="Modalité préférée" aria-labelledby="preferredModalityLabel" value={formData.preferredModality} onValueChange={(value) => handleInputChange('preferredModality', value)}>
app/bilan-gratuit/page.tsx:575:                          <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" aria-label="Chargement" />
components/ui/badge-widget.tsx:32:    case 'ARIA':
components/ui/badge-widget.tsx:46:    case 'ARIA':
components/ui/badge-widget.tsx:85:          description: 'Première question posée à ARIA',
components/ui/badge-widget.tsx:86:          category: 'ARIA',
app/dashboard/parent/paiement/wise/page.tsx:137:        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-neutral-400">
components/sections/problem-solution-section.tsx:52:              Visez l&apos;excellence avec ARIA, votre tuteur IA 24/7.
app/dashboard/parent/paiement/konnect-demo/page.tsx:90:        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-neutral-400">
app/dashboard/parent/paiement/confirmation/page.tsx:14:          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-neutral-400">
components/sections/korrigo-features.tsx:21:                Smart Feedback (IA + RAG)
components/sections/pillars-grid.tsx:61:                <li>• Agents Autonomes (Vie scolaire / Tutorat)</li>
app/dashboard/parent/page.tsx:16:import AriaAddonDialog from "./aria-addon-dialog"
app/dashboard/parent/page.tsx:115:          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
app/dashboard/parent/page.tsx:126:          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" aria-label="Erreur" />
app/dashboard/parent/page.tsx:150:                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-brand-accent flex-shrink-0" aria-hidden="true" />
app/dashboard/parent/page.tsx:175:              aria-label="Se déconnecter"
app/dashboard/parent/page.tsx:177:              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" aria-hidden="true" />
components/sections/pillars-section.tsx:28:      "**IA ARIA** entraînée sur nos contenus exclusifs",
components/sections/pillars-section.tsx:218:                        alt="ARIA - Notre Intelligence Artificielle"
components/navigation/Sidebar.tsx:30:          <nav className="flex-1 px-4" aria-label="Navigation principale">
components/navigation/Navbar.tsx:27:        <nav className="hidden lg:flex items-center gap-4" aria-label="Actions utilisateur">
components/sections/approach-section-gsap.tsx:59:            description: "Coachs + IA ARIA + rythme adapté pour avancer vite.",
components/navigation/MobileMenuToggle.tsx:16:      aria-label="Ouvrir le menu"
components/navigation/MobileMenuToggle.tsx:17:      aria-expanded={isOpen}
components/navigation/MobileMenu.tsx:148:        aria-hidden="true"
components/navigation/MobileMenu.tsx:154:        aria-modal="true"
components/navigation/MobileMenu.tsx:155:        aria-label="Navigation mobile"
components/navigation/MobileMenu.tsx:169:              aria-label="Fermer le menu"
components/navigation/MobileMenu.tsx:171:              <X className="h-5 w-5" aria-hidden="true" />
components/navigation/MobileMenu.tsx:180:            <nav className="px-4 pb-4" aria-label="Navigation mobile">
components/sections/offer-section-gsap.tsx:110:                { icon: Bot, text: "IA ARIA 24/7 (1 matière)" },
components/sections/offer-section-gsap.tsx:122:                { icon: Bot, text: "IA ARIA 24/7" },
components/sections/offer-section-gsap.tsx:133:                { icon: Bot, text: "IA ARIA 24/7" },
components/sections/offer-section-gsap.tsx:245:                            <span className="block text-white text-xs font-medium">IA ARIA 24/7</span>
app/dashboard/parent/paiement/page.tsx:144:        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-neutral-400">
components/sections/hero-section-gsap.tsx:91:        { icon: Cpu, label: 'IA ARIA 24/7', color: 'blue' },
components/sections/hero-section-gsap.tsx:154:                            <Sparkles className="w-4 h-4 text-brand-primary" aria-hidden="true" />
components/sections/hero-section-gsap.tsx:171:                            Coachs agrégés, IA ARIA 24/7 et suivi parent clair :
components/sections/hero-section-gsap.tsx:185:                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
components/navigation/UserProfile.tsx:27:    <div className="mx-4 mb-6 rounded-card bg-surface-elevated p-4" role="region" aria-label="Profil utilisateur">
components/navigation/UserProfile.tsx:40:          <span className="inline-flex items-center px-2 py-0.5 rounded-micro text-xs font-medium bg-brand-accent/10 text-brand-accent" aria-label={`Rôle : ${roleLabel}`}>
components/navigation/LogoutButton.tsx:17:      aria-label="Se déconnecter de votre compte"
components/navigation/LogoutButton.tsx:19:      <LogOut className="h-5 w-5" aria-hidden="true" />
components/sections/korrigo-showcase.tsx:25:              Korrigo et ARIA ne sont pas juste des produits. Ce sont nos
components/sections/detailed-services.tsx:43:          "Équipez votre structure avec Korrigo, des Agents Vie Scolaire et une certification sécurisée.",
components/sections/detailed-services.tsx:45:          "Ne laissez pas la tech gérer votre école, utilisez la tech pour la piloter. Nous déployons chez vous : 1) Korrigo pour diviser par deux le temps de correction des profs. 2) Des Agents IA sécurisés pour l'administratif. 3) Une certification sécurisée des diplômes pour votre image de marque.",
components/sections/detailed-services.tsx:87:        title: "ARIA : Tuteur IA 24/7",
components/sections/detailed-services.tsx:150:        shortDesc: "Apprenez à construire et orchestrer des agents IA autonomes.",
components/sections/detailed-services.tsx:152:          "Le futur n'est plus au Chatbot, mais à l'Agent qui agit. Apprenez à utiliser les frameworks modernes (LangChain, AutoGen) pour créer des agents capables de coder, de faire de la recherche ou de gérer un service client de A à Z.",
components/sections/detailed-services.tsx:154:          "Maîtrise des LLMs (OpenAI/Mistral)",
components/sections/detailed-services.tsx:270:                Accédez à votre espace complet : Tuteur ARIA, Cours en Visio et
components/sections/detailed-services.tsx:298:              aria-label="Fermer"
components/sections/micro-engagement-section.tsx:3:import { AriaWidget } from '@/components/ui/aria-widget';
components/sections/micro-engagement-section.tsx:24:              Curieux de voir <span className="text-blue-600">ARIA en action</span> ?
components/sections/micro-engagement-section.tsx:78:      {/* Widget ARIA */}
components/sections/how-it-works-section.tsx:12:    subtitle: "Korrigo, ARIA ou dév sur mesure - Nous choisissons ensemble.",
components/navigation/NavigationItem.tsx:42:      aria-current={isActive ? "page" : undefined}
components/navigation/NavigationItem.tsx:44:      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
components/sections/testimonials-section.tsx:17:      "Ma fille a repris confiance en Maths grâce au tuteur ARIA. C'est bluffant.",
components/sections/candidat-libre-section.tsx:12:    "Accès Illimité à la Plateforme & ARIA+ (Toutes matières)",
components/sections/hero-section.tsx:147:          Nous fusionnons l'expertise de <span className="text-blue-300 font-semibold">professeurs d'élite de l'enseignement français</span> avec la puissance de notre <span className="text-blue-300 font-semibold">plateforme intelligente ARIA</span>. L'objectif : transformer le potentiel de votre enfant en une <span className="text-blue-300 font-semibold">mention au Bac</span> et un <span className="text-blue-300 font-semibold">avenir choisi sur Parcoursup</span>.
components/sections/hero-section.tsx:166:              <span className="text-blue-600 font-semibold">IA ARIA</span> 24/7
components/sections/trinity-services-gsap.tsx:73:            title: "IA ARIA 24/7",
components/sections/trinity-services-gsap.tsx:140:                                        <CheckCircle2 className={`w-4 h-4 ${service.color}`} aria-hidden="true" />
components/sections/home-hero.tsx:118:                        <span className="text-sm font-semibold">Agent ARIA</span>
components/sections/testimonials-section-gsap.tsx:81:            content: "ARIA m’aide à réviser quand je bloque, et le coach vérifie tout en cours.",
components/sections/dna-section-gsap.tsx:44:        "IA ARIA disponible 24/7",
components/ui/offers-comparison.tsx:18:  { name: "Accès à l'IA ARIA", cortex: true, academies: false, odyssee: true },
components/ui/offers-comparison.tsx:41:    valueBreakdown: "Inclus : 20 crédits (valeur 140 TND) + Accès ARIA (valeur 50 TND). Valeur totale : 190 TND, votre prix : 90 TND.",
components/sections/comparison-table-section.tsx:33:      nexus: "Plateforme intelligente & IA ARIA."
components/sections/business-model-section.tsx:25:      "ARIA (1 matière)"
components/sections/business-model-section.tsx:55:// Matières disponibles pour ARIA
components/sections/business-model-section.tsx:67:// Composant interactif ARIA
components/sections/business-model-section.tsx:94:      {/* En-tête avec ARIA */}
components/sections/business-model-section.tsx:98:            src="/images/aria.png"
components/sections/business-model-section.tsx:99:            alt="ARIA - Assistant IA"
components/sections/business-model-section.tsx:107:            L'Offre IA "ARIA"
components/sections/business-model-section.tsx:311:                  Accès complet à la plateforme, ARIA, suivi personnalisé +
components/sections/business-model-section.tsx:457:        {/* Module ARIA Interactif */}
components/sections/business-model-section.tsx:540:                        Inclut un plan de travail personnalisé, des sessions de suivi hebdomadaires, et un accès complet à la plateforme et à ARIA.
components/sections/business-model-section.tsx:553:                          <span className="text-gray-700 leading-relaxed">Accès complet plateforme + ARIA toutes matières</span>
components/sections/contact-section.tsx:397:                      <option>Activer ARIA (tuteur IA & suivi)</option>
components/sections/contact-section.tsx:398:                      <option>Studio IA / Agents autonomes</option>
components/sections/contact-section.tsx:415:                      <option>Découvrir ARIA (tuteur IA)</option>
components/sections/contact-section.tsx:425:                      <option>Studio IA / Agents autonomes</option>
app/stages/page.tsx:1067:                        aria-label="Moyenne scolaire"
app/stages/page.tsx:1552:                            aria-label="Choisir une académie"
