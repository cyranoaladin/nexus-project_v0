#!/usr/bin/env node

// Script to check NextAuth configuration
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking NextAuth Configuration...\n');

// Check for environment files
const envFiles = ['.env', '.env.local', '.env.development'];
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
  console.log('\n📝 Creating .env.local file...');
  
  const envContent = `# =============================================================================
# CONFIGURATION DATABASE (PostgreSQL pour développement)
# =============================================================================
DATABASE_URL="postgresql://nexus_user:nexus_password@localhost:5432/nexus_reussite_dev?schema=public"

# =============================================================================
# CONFIGURATION NEXTAUTH
# =============================================================================
NEXTAUTH_URL="http://localhost:3002"
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars-for-development-change-in-production"

# =============================================================================
# CONFIGURATION ENVIRONNEMENT
# =============================================================================
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3002"
`;

  fs.writeFileSync(path.join(process.cwd(), '.env.local'), envContent);
  console.log('✅ Created .env.local file');
}

console.log('\n🎯 Next Steps:');
console.log('1. Restart your development server');
console.log('2. Clear browser cookies and localStorage');
console.log('3. Try logging in again');

console.log('\n📋 Manual Environment Setup:');
console.log('Create a .env.local file in your project root with:');
console.log('NEXTAUTH_URL="http://localhost:3002"');
console.log('NEXTAUTH_SECRET="your-super-secret-key-min-32-chars-for-development"');
console.log('DATABASE_URL="postgresql://nexus_user:nexus_password@localhost:5432/nexus_reussite_dev?schema=public"');
console.log('NODE_ENV="development"'); 