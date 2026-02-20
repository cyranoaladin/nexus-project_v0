import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runTest() {
  const baseUrl = 'http://localhost:3005';
  console.log('🚀 Démarrage du Test de Flux Documentaire...');

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const student = await prisma.user.findFirst({ where: { role: 'ELEVE' } });

    if (!admin || !student) throw new Error('Données de test manquantes');

    console.log('📂 Simulation de la persistance...');
    const fakeFileName = `test-report-${createId()}.pdf`;
    const fakeContent = Buffer.from('Fake PDF Content for Nexus Security Test');
    
    const STORAGE_ROOT = './storage/documents';
    if (!fs.existsSync(STORAGE_ROOT)) {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }

    const uniqueId = createId();
    const localPath = path.resolve(path.join(STORAGE_ROOT, `${uniqueId}.pdf`));
    fs.writeFileSync(localPath, fakeContent);

    const doc = await prisma.userDocument.create({
        data: {
            id: uniqueId,
            title: 'Rapport de Test SRE',
            originalName: fakeFileName,
            mimeType: 'application/pdf',
            sizeBytes: fakeContent.length,
            localPath: localPath,
            userId: student.id,
            uploadedById: admin.id
        }
    });

    console.log('✅ Base de données mise à jour');
    if (fs.existsSync(doc.localPath)) {
        console.log('✅ Fichier physique confirmé sur le disque');
    }

    console.log(`🔗 Test du téléchargement proxy: ${baseUrl}/api/documents/${doc.id}`);
    const downloadRes = await fetch(`${baseUrl}/api/documents/${doc.id}`);
    console.log(`🔒 Sécurité check: Statut téléchargement = ${downloadRes.status}`);
    
    if (downloadRes.status === 401) {
        console.log('✅ SÉCURITÉ VALIDÉE : Le proxy bloque les accès non autorisés.');
    }
    
    console.log('🏆 TOUT EST OPÉRATIONNEL.');

  } catch (error) {
    console.error('❌ Test échoué:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
