# Development Setup Guide

## Quick Start for Development

### 1. Create Environment File

Create a `.env` file in your project root with the following content:

```env
# =============================================================================
# CONFIGURATION DATABASE (SQLite pour développement)
# =============================================================================
DATABASE_URL="file:./prisma/dev.db"

# =============================================================================
# CONFIGURATION NEXTAUTH
# =============================================================================
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars-for-development-change-in-production"

# =============================================================================
# CONFIGURATION ENVIRONNEMENT
# =============================================================================
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# =============================================================================
# CONFIGURATION OPENAI (IA ARIA) - Optionnel
# =============================================================================
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# =============================================================================
# CONFIGURATION PAIEMENTS - Optionnel pour développement
# =============================================================================
KONNECT_API_KEY="your-konnect-api-key"
KONNECT_WALLET_ID="your-wallet-id"
KONNECT_BASE_URL="https://api.konnect.network"
KONNECT_WEBHOOK_SECRET="your-webhook-secret"

NEXT_PUBLIC_WISE_BENEFICIARY_NAME="Nexus Réussite SARL"
NEXT_PUBLIC_WISE_IBAN="TN59 1234 5678 9012 3456 7890 12"
NEXT_PUBLIC_WISE_BIC="BANKTNTT"
NEXT_PUBLIC_WISE_ADDRESS="123 Avenue Habib Bourguiba, Tunis 1000, Tunisie"
NEXT_PUBLIC_WISE_BANK_NAME="Banque Internationale Arabe de Tunisie"

# =============================================================================
# CONFIGURATION JITSI MEET
# =============================================================================
JITSI_DOMAIN="meet.jit.si"
```

### 2. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database (optional)
npm run db:seed
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Test the Application

1. **Visit the homepage**: http://localhost:3000
2. **Test the bilan gratuit form**: http://localhost:3000/bilan-gratuit
3. **Test login**: http://localhost:3000/auth/signin

## Current Status

✅ **Form is working** - The bilan gratuit form successfully creates users
✅ **Database is working** - SQLite database is properly configured
✅ **Email handling** - Gracefully handles email errors in development
✅ **Authentication** - NextAuth is configured and working

## Known Issues Fixed

1. **Email SMTP errors** - Now handled gracefully in development
2. **NextAuth warnings** - Added proper secret configuration
3. **Form validation** - Working correctly with proper error handling

## Next Steps

1. **Move project to user directory** to avoid permission issues
2. **Configure production environment** when ready to deploy
3. **Set up proper SMTP** for email functionality
4. **Configure payment providers** for production use

## Troubleshooting

### Permission Issues
If you encounter permission errors, move the project to a user directory:
```bash
# Create new directory
mkdir C:\Users\YourUsername\Projects

# Copy project
xcopy "C:\Program Files\Git\nexus-project_v0" "C:\Users\YourUsername\Projects\nexus-project_v0" /E /I /H

# Navigate to new location
cd C:\Users\YourUsername\Projects\nexus-project_v0
```

### Database Issues
If database operations fail:
```bash
# Reset database
npx prisma migrate reset

# Or push schema directly
npx prisma db push
```

### Port Issues
If port 3000 is in use, the server will automatically try 3001, 3002, etc. 