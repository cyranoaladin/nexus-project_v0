"use strict";
/**
 * Seed script to create Zakaria AMAIMIA's student profile,
 * associate coach alaeddine.benrhouma@ert.tn, and inject the diagnostic bilan.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-zakaria.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding Zakaria AMAIMIA + Coach Alaeddine...');
    const hashedPassword = await bcryptjs_1.default.hash('Nexus2026!', 10);
    // ──── 1. Load diagnostic JSON ─────────────────────────────────────────────
    const diagnosticPath = path.resolve(__dirname, '../diagnostic_maths_Zakaria_AMAIMIA_2026-04-27.json');
    const diagnosticRaw = fs.readFileSync(diagnosticPath, 'utf-8');
    const diagnosticJson = JSON.parse(diagnosticRaw);
    console.log(`  📄 Loaded diagnostic JSON (step: ${diagnosticJson.step}, QCM score: ${diagnosticJson.evaluatedData?.qcmRawScore}/${diagnosticJson.evaluatedData?.qcmMaxScore})`);
    // ──── 2. Create Coach: alaeddine.benrhouma@ert.tn ──────────────────────────
    const coachUser = await prisma.user.upsert({
        where: { email: 'alaeddine.benrhouma@ert.tn' },
        update: { activatedAt: new Date() },
        create: {
            email: 'alaeddine.benrhouma@ert.tn',
            password: hashedPassword,
            firstName: 'Alaeddine',
            lastName: 'Benrhouma',
            role: 'COACH',
            activatedAt: new Date(),
        },
    });
    console.log(`  ✅ Coach user: ${coachUser.email} (id: ${coachUser.id})`);
    const coachProfile = await prisma.coachProfile.upsert({
        where: { userId: coachUser.id },
        update: {
            subjects: [client_1.Subject.MATHEMATIQUES],
        },
        create: {
            userId: coachUser.id,
            pseudonym: 'Coach Alaeddine',
            subjects: [client_1.Subject.MATHEMATIQUES],
            title: 'Professeur de Mathématiques',
            description: 'Spécialiste Terminale EDS — Préparation Bac',
        },
    });
    console.log(`  ✅ Coach profile: ${coachProfile.pseudonym} (id: ${coachProfile.id})`);
    // ──── 3. Create Parent profile (required FK) ──────────────────────────────
    const parentEmail = 'parent.amaimia@nexus-reussite.com';
    const parentUser = await prisma.user.upsert({
        where: { email: parentEmail },
        update: { activatedAt: new Date() },
        create: {
            email: parentEmail,
            password: hashedPassword,
            firstName: 'Parent',
            lastName: 'AMAIMIA',
            role: 'PARENT',
            activatedAt: new Date(),
        },
    });
    const parentProfile = await prisma.parentProfile.upsert({
        where: { userId: parentUser.id },
        update: {},
        create: { userId: parentUser.id },
    });
    console.log(`  ✅ Parent profile: ${parentProfile.id}`);
    // ──── 4. Create Student: Zakaria AMAIMIA ──────────────────────────────────
    const studentEmail = 'zakaria.amaimia@nexus-reussite.com';
    const studentUser = await prisma.user.upsert({
        where: { email: studentEmail },
        update: { activatedAt: new Date() },
        create: {
            email: studentEmail,
            password: hashedPassword,
            firstName: 'Zakaria',
            lastName: 'AMAIMIA',
            role: 'ELEVE',
            activatedAt: new Date(),
        },
    });
    console.log(`  ✅ Student user: ${studentUser.email} (id: ${studentUser.id})`);
    const studentProfile = await prisma.student.upsert({
        where: { userId: studentUser.id },
        update: {
            grade: 'TERMINALE',
            gradeLevel: client_1.GradeLevel.TERMINALE,
            academicTrack: client_1.AcademicTrack.EDS_GENERALE,
            specialties: [client_1.Subject.MATHEMATIQUES],
            updatedTrackAt: new Date(),
        },
        create: {
            userId: studentUser.id,
            grade: 'TERMINALE',
            gradeLevel: client_1.GradeLevel.TERMINALE,
            academicTrack: client_1.AcademicTrack.EDS_GENERALE,
            specialties: [client_1.Subject.MATHEMATIQUES],
            updatedTrackAt: new Date(),
            credits: 10,
            parentId: parentProfile.id,
        },
    });
    console.log(`  ✅ Student profile: ${studentProfile.id} (TERMINALE / EDS_GENERALE / MATHEMATIQUES)`);
    // ──── 4. Create CoachStudentAssignment ─────────────────────────────────────
    const existingAssignment = await prisma.coachStudentAssignment.findFirst({
        where: {
            coachId: coachProfile.id,
            studentId: studentProfile.id,
            status: 'ACTIVE',
        },
    });
    if (!existingAssignment) {
        await prisma.coachStudentAssignment.create({
            data: {
                coachId: coachProfile.id,
                studentId: studentProfile.id,
                assignmentType: 'PRIMARY',
                status: 'ACTIVE',
                subjects: [client_1.Subject.MATHEMATIQUES],
                notes: 'Coach principal — Stage Printemps 2026',
                startsAt: new Date(),
            },
        });
        console.log(`  ✅ CoachStudentAssignment created (ACTIVE / PRIMARY)`);
    }
    else {
        console.log(`  ⏭️  CoachStudentAssignment already exists`);
    }
    // ──── 5. Create SessionBooking (needed for coach dashboard discovery) ──────
    const bookingId = 'seed-booking-zakaria-alaeddine';
    await prisma.sessionBooking.upsert({
        where: { id: bookingId },
        update: {
            studentId: studentUser.id,
            coachId: coachUser.id,
        },
        create: {
            id: bookingId,
            studentId: studentUser.id,
            coachId: coachUser.id,
            subject: client_1.Subject.MATHEMATIQUES,
            title: 'Session Diagnostic — Analyse du bilan',
            scheduledDate: new Date('2026-04-28T09:00:00.000Z'),
            startTime: '09:00',
            endTime: '11:00',
            duration: 120,
            status: 'CONFIRMED',
            coachNotes: 'Première session — Analyse du bilan diagnostic',
        },
    });
    console.log(`  ✅ SessionBooking created for dashboard visibility`);
    // ──── 6. Build and insert Bilan ────────────────────────────────────────────
    const { progress, qcmAnswers, openAnswers, teacherGrades, isTeacherGraded, evaluatedData, step, } = diagnosticJson;
    const sourceData = {
        version: 'maths_terminale_v1',
        progress,
        qcmAnswers,
        openAnswers,
        teacherGrades: teacherGrades || {},
        isTeacherGraded: isTeacherGraded || false,
        evaluatedData,
        step: step || 'results',
    };
    // Build domain scores array
    const domainScores = evaluatedData.domainScores
        ? Object.entries(evaluatedData.domainScores).map(([domainId, score]) => ({
            domainId,
            domain: domainId,
            score: score,
        }))
        : [];
    const bilanId = 'seed-bilan-zakaria-maths-terminale';
    await prisma.bilan.upsert({
        where: { id: bilanId },
        update: {
            studentId: studentProfile.id,
            studentEmail: studentEmail,
            studentName: 'Zakaria AMAIMIA',
            sourceData: sourceData,
            globalScore: evaluatedData.qcmPercentage ?? 67,
            domainScores: domainScores,
            status: client_1.BilanStatus.SCORING, // Awaiting coach grading
            progress: 100,
        },
        create: {
            id: bilanId,
            type: 'DIAGNOSTIC_PRE_STAGE',
            subject: 'MATHEMATIQUES',
            studentId: studentProfile.id,
            studentEmail: studentEmail,
            studentName: 'Zakaria AMAIMIA',
            sourceData: sourceData,
            globalScore: evaluatedData.qcmPercentage ?? 67,
            domainScores: domainScores,
            sourceVersion: 'maths_terminale_v1',
            status: client_1.BilanStatus.SCORING,
            progress: 100,
        },
    });
    console.log(`  ✅ Bilan DIAGNOSTIC_PRE_STAGE created (status: SCORING, globalScore: ${evaluatedData.qcmPercentage}%)`);
    // ──── Summary ──────────────────────────────────────────────────────────────
    console.log('\n🎯 Seed complete! Login credentials:');
    console.log('  📚 Élève     : zakaria.amaimia@nexus-reussite.com / Nexus2026!');
    console.log('  🎓 Coach     : alaeddine.benrhouma@ert.tn / Nexus2026!');
    console.log('\n  Workflow:');
    console.log('  1. Zakaria se connecte → Dashboard → Bilan Diagnostic visible (résultats provisoires)');
    console.log('  2. Alaeddine se connecte → Dashboard → Alerte "Bilan à corriger" → Dossier Zakaria');
    console.log('  3. Le coach corrige les exercices ouverts → Score final + Parcours généré');
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
