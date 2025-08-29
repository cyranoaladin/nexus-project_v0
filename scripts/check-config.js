#!/usr/bin/env node

// Script to check NextAuth configuration
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking NextAuth Configuration...\n');

// Check for environment files
const envFiles = ['.env.local', '.env', '.env.development'];
let envFileFound = false;

envFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ Found ${file}`);
    envFileFound = true;
    
    // Read and check for NEXTAUTH_SECRET
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('NEXTAUTH_SECRET')) {
      console.log(`✅ NEXTAUTH_SECRET found in ${file}`);
    } else {
      console.log(`⚠️  NEXTAUTH_SECRET missing in ${file}`);
    }
    
    if (content.includes('NEXTAUTH_URL')) {
      console.log(`✅ NEXTAUTH_URL found in ${file}`);
    } else {
      console.log(`⚠️  NEXTAUTH_URL missing in ${file}`);
    }
  } else {
    console.log(`❌ ${file} not found`);
  }
});

if (!envFileFound) {
  console.log('\n📝 Creating .env.local file (PostgreSQL dev)...');
  
  const envContent = `# =============================================================================
# CONFIGURATION DATABASE (PostgreSQL pour développement)
# =============================================================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public

# =============================================================================
# CONFIGURATION NEXTAUTH
# =============================================================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change_me_in_development

# =============================================================================
# SERVICES IA LOCAUX
# =============================================================================
LLM_SERVICE_URL=http://localhost:8003
PDF_GENERATOR_SERVICE_URL=http://localhost:8002
RAG_SERVICE_URL=http://localhost:8001

# =============================================================================
# CONFIGURATION ENVIRONNEMENT
# =============================================================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  fs.writeFileSync(path.join(process.cwd(), '.env.local'), envContent);
  console.log('✅ Created .env.local file');
}

console.log('\n🎯 Next Steps:');
console.log('1. Restart your development server (npm run dev)');
console.log('2. Ensure PostgreSQL is running on port 5433');
console.log('3. Run: npx prisma generate && npm run db:push && npm run db:seed');

console.log('\n📋 Manual Environment Setup (sample):');
console.log('NEXTAUTH_URL=http://localhost:3000');
console.log('NEXTAUTH_SECRET=change_me_in_development');
console.log('DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public');
console.log('LLM_SERVICE_URL=http://localhost:8003');
console.log('PDF_GENERATOR_SERVICE_URL=http://localhost:8002');
console.log('RAG_SERVICE_URL=http://localhost:8001');
