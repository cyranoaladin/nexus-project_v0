import { readFileSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { AcademicTrack, GradeLevel, PrismaClient, StmgPathway, UserRole } from "@prisma/client";
import { SYSTEM_PARENT_EMAIL } from "../lib/constants";

export interface StmgStudentInput {
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
}

interface PrismaHealthClient {
  user: {
    findFirst(args: { take: number }): Promise<unknown>;
  };
}

interface StudentCreationClient extends PrismaHealthClient {
  user: {
    findFirst(args: { take: number }): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  parentProfile: {
    create(args: unknown): Promise<unknown>;
  };
  student: {
    upsert(args: unknown): Promise<unknown>;
  };
}

type ReadFile = (filePath: string, encoding: BufferEncoding) => string;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStudentEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireText(value: unknown, field: string, index: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Entrée ${index + 1}: champ ${field} requis.`);
  }
  return value.trim();
}

export function parseStudentInputs(value: unknown): StmgStudentInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Le fichier d’entrée doit contenir au moins un élève.");
  }

  const seenEmails = new Set<string>();

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Entrée ${index + 1}: objet élève invalide.`);
    }

    const row = entry as Record<string, unknown>;
    const email = normalizeStudentEmail(requireText(row.email, "email", index));
    if (!emailPattern.test(email)) {
      throw new Error(`Entrée ${index + 1}: email invalide.`);
    }
    if (seenEmails.has(email)) {
      throw new Error(`Entrée ${index + 1}: doublon email ${email}.`);
    }
    seenEmails.add(email);

    return {
      firstName: requireText(row.firstName, "firstName", index),
      lastName: requireText(row.lastName, "lastName", index),
      email,
      grade: requireText(row.grade, "grade", index),
    };
  });
}

export function buildStudentInputsFromFile(filePath: string, readFile: ReadFile = readFileSync): StmgStudentInput[] {
  const raw = readFile(filePath, "utf8");
  try {
    return parseStudentInputs(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON invalide dans ${filePath}.`);
    }
    throw error;
  }
}

export function shouldApplyChanges(args: string[]): boolean {
  return args.includes("--apply");
}

export function getInputPath(args: string[]): string {
  const inputIndex = args.indexOf("--input");
  if (inputIndex === -1 || !args[inputIndex + 1]) {
    throw new Error("Argument requis : --input <fichier-json>.");
  }
  return args[inputIndex + 1];
}

export async function assertDatabaseCompatible(prisma: PrismaHealthClient): Promise<void> {
  try {
    await prisma.user.findFirst({ take: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/column .* does not exist|does not exist in the current database|totp/i.test(message)) {
      throw new Error(
        "Base incompatible avec le Prisma Client actuel.\n" +
          "Cause probable : schema.prisma contient des champs non migrés.\n" +
          "Action : traiter le lot Prisma/TOTP avant création des élèves."
      );
    }
    throw error;
  }
}

function generateTemporaryPassword(): string {
  return `Nx-${randomBytes(18).toString("base64url")}!`;
}

function redactedDatabaseUrl() {
  return process.env.DATABASE_URL?.replace(/:[^:@/]*@/, ":****@") ?? "(DATABASE_URL absente)";
}

function loadEnvironment() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

async function ensureTechnicalParent(prisma: StudentCreationClient) {
  const existing = await prisma.user.findUnique({
    where: { email: SYSTEM_PARENT_EMAIL },
    include: { parentProfile: true },
  }) as { id: string; role: UserRole; parentProfile?: { id: string } | null } | null;

  if (existing?.parentProfile) return existing.parentProfile;
  if (existing && existing.role !== UserRole.PARENT) {
    throw new Error(`Le compte technique ${SYSTEM_PARENT_EMAIL} existe avec le rôle ${existing.role}, pas PARENT.`);
  }

  const parent = existing
    ? existing
    : await prisma.user.create({
        data: {
          email: SYSTEM_PARENT_EMAIL,
          role: UserRole.PARENT,
          firstName: "Parent",
          lastName: "Technique",
          password: null,
          activatedAt: new Date(),
        },
      }) as { id: string };

  return prisma.parentProfile.create({
    data: {
      userId: parent.id,
      country: "Tunisie",
    },
  }) as Promise<{ id: string }>;
}

async function dryRun(prisma: StudentCreationClient, students: StmgStudentInput[]) {
  await assertDatabaseCompatible(prisma);

  console.log("Mode dry-run : aucune écriture en base.");
  console.log(`DATABASE_URL ciblée : ${redactedDatabaseUrl()}`);

  const parent = await prisma.user.findUnique({
    where: { email: SYSTEM_PARENT_EMAIL },
    include: { parentProfile: true },
  }) as { parentProfile?: { id: string } | null } | null;
  console.log(`Parent technique : ${parent?.parentProfile ? "présent" : "à créer si --apply"}`);

  for (const student of students) {
    const existing = await prisma.user.findUnique({
      where: { email: student.email },
      include: { student: true },
    }) as { role: UserRole; student?: { id: string } | null } | null;
    console.log(`${student.email} : ${existing ? `existe déjà (${existing.role}, studentId=${existing.student?.id ?? "absent"})` : "à créer"}`);
  }
}

async function apply(prisma: StudentCreationClient, students: StmgStudentInput[]) {
  await assertDatabaseCompatible(prisma);

  console.log("Création idempotente des élèves Première STMG.");
  console.log(`DATABASE_URL ciblée : ${redactedDatabaseUrl()}`);

  const parentProfile = await ensureTechnicalParent(prisma);
  const results: Array<{ email: string; studentId: string; status: "créé" | "déjà existant"; temporaryPassword?: string }> = [];

  for (const student of students) {
    const existing = await prisma.user.findUnique({
      where: { email: student.email },
      include: { student: true },
    }) as { id: string; role: UserRole; firstName?: string | null; lastName?: string | null; activatedAt?: Date | null } | null;

    if (existing) {
      if (existing.role !== UserRole.ELEVE) {
        throw new Error(`Collision email ${student.email}: rôle existant ${existing.role}, attendu ELEVE.`);
      }

      const upsertedStudent = await prisma.student.upsert({
        where: { userId: existing.id },
        update: {
          grade: student.grade,
          gradeLevel: GradeLevel.PREMIERE,
          academicTrack: AcademicTrack.STMG,
          stmgPathway: StmgPathway.INDETERMINE,
          specialties: [],
          updatedTrackAt: new Date(),
        },
        create: {
          userId: existing.id,
          parentId: parentProfile.id,
          grade: student.grade,
          gradeLevel: GradeLevel.PREMIERE,
          academicTrack: AcademicTrack.STMG,
          stmgPathway: StmgPathway.INDETERMINE,
          specialties: [],
          updatedTrackAt: new Date(),
        },
        select: { id: true },
      }) as { id: string };

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName ?? student.firstName,
          lastName: existing.lastName ?? student.lastName,
          activatedAt: existing.activatedAt ?? new Date(),
        },
      });

      results.push({ email: student.email, studentId: upsertedStudent.id, status: "déjà existant" });
      continue;
    }

    const temporaryPassword = generateTemporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 12);
    const created = await prisma.user.create({
      data: {
        email: student.email,
        role: UserRole.ELEVE,
        firstName: student.firstName,
        lastName: student.lastName,
        password,
        activatedAt: new Date(),
        student: {
          create: {
            parentId: parentProfile.id,
            grade: student.grade,
            gradeLevel: GradeLevel.PREMIERE,
            academicTrack: AcademicTrack.STMG,
            stmgPathway: StmgPathway.INDETERMINE,
            specialties: [],
            updatedTrackAt: new Date(),
          },
        },
      },
      include: { student: true },
    }) as { student?: { id: string } | null };

    results.push({ email: student.email, studentId: created.student?.id ?? "", status: "créé", temporaryPassword });
  }

  console.log("\nIdentifiants temporaires à transmettre une seule fois :");
  for (const result of results) {
    const suffix = result.temporaryPassword ? ` / mot de passe temporaire : ${result.temporaryPassword}` : " / mot de passe inchangé (compte déjà existant)";
    console.log(`- ${result.email}${suffix}`);
  }

  console.log("\nRésumé :");
  for (const result of results) {
    console.log(`- ${result.email} : ${result.status}, studentId=${result.studentId}`);
  }
}

export async function runCreateStmgStudents(prisma: StudentCreationClient, students: StmgStudentInput[], applyChanges: boolean) {
  if (applyChanges) await apply(prisma, students);
  else await dryRun(prisma, students);
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = getInputPath(args);
  const applyChanges = shouldApplyChanges(args);
  const students = buildStudentInputsFromFile(inputPath);

  loadEnvironment();

  const prisma = new PrismaClient();
  try {
    await runCreateStmgStudents(prisma, students, applyChanges);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
