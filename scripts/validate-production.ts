import { createId } from '@paralleldrive/cuid2';
import { serializeError } from '@/lib/utils/serialize-error';

async function run() {
  const baseUrl = 'http://localhost:3002';
  console.log(`🚀 Starting User Journey Validation on ${baseUrl}`);

  // 1. Bilan Gratuit (Inscription)
  console.log('1️⃣  Testing Bilan Gratuit Registration...');
  const parentEmail = `parent-${createId()}@test.local`;
  const parentPassword = 'SecurePassword123!';
  
  const registrationPayload = {
    parentFirstName: "Jean",
    parentLastName: "Testeur",
    parentEmail: parentEmail,
    parentPhone: "50123456",
    parentPassword: parentPassword,
    studentFirstName: "Kevin",
    studentLastName: "Testeur",
    studentGrade: "TERMINALE",
    studentSchool: "PMF",
    studentBirthDate: "2008-01-01",
    subjects: ["MATHEMATIQUES", "PHYSIQUE_CHIMIE"],
    currentLevel: "TERMINALE",
    acceptTerms: true
  };

  const regRes = await fetch(`${baseUrl}/api/bilan-gratuit`, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000' 
    },
    body: JSON.stringify(registrationPayload)
  });

  if (!regRes.ok) {
    const err = await regRes.text();
    console.error('❌ Registration Failed:', regRes.status, serializeError(err));
    process.exit(1);
  }
  const regData = await regRes.json();
  console.log('✅ Registration Success:', regData);

  if (!regData.studentId || !regData.parentId) {
      console.error('❌ Registration did not return expected IDs');
      process.exit(1);
  }

  console.log('🎉 Validation User Journey Complete!');
}

run().catch((error) => {
  console.error(serializeError(error));
});
