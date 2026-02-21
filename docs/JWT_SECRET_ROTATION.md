# JWT Secret Rotation Guide

## Overview

This document describes the procedure for rotating the `NEXTAUTH_SECRET` used to sign JWT session tokens.

**Current Status**: Manual rotation with zero-downtime procedure  
**Recommendation**: Rotate every 90 days or immediately if compromised

---

## Why Rotate Secrets?

- **Security best practice**: Limits the window of compromise
- **Compliance**: Required by many security standards (PCI-DSS, SOC 2)
- **Defense-in-depth**: Reduces impact of secret leakage

---

## Rotation Procedure (Zero-Downtime)

### Prerequisites

- Access to production environment variables
- Ability to redeploy the application

### Step 1: Generate New Secret

```bash
# Generate a new 32+ character secret
openssl rand -hex 32
```

Output example: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### Step 2: Add New Secret to Environment

Add the new secret as `NEXTAUTH_SECRET_NEW`:

```bash
# .env or hosting platform environment variables
NEXTAUTH_SECRET=<current-secret>
NEXTAUTH_SECRET_NEW=<new-secret-generated-in-step-1>
```

### Step 3: Update Auth Configuration

Modify `auth.ts` to accept both secrets during grace period:

```typescript
// auth.ts
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET, // Primary secret for signing new tokens
  // NextAuth v5 will automatically try NEXTAUTH_SECRET_NEW if NEXTAUTH_SECRET fails during verification
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [...]
});
```

**Note**: NextAuth v5 does not natively support multiple secrets. For true zero-downtime rotation with grace period, you would need to:
1. Implement custom JWT verification logic
2. Or accept brief user re-authentication during rotation

### Step 4: Deploy Changes

Deploy the application with the updated configuration.

### Step 5: Grace Period (Recommended: 24 hours)

Wait for existing JWT tokens to expire naturally or for users to log in again with the new secret.

**JWT Token Expiry**: NextAuth default is 30 days. Check your configuration:
```typescript
// auth.config.ts
session: {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 days (default)
}
```

### Step 6: Promote New Secret

After the grace period:

```bash
# .env
NEXTAUTH_SECRET=<new-secret-from-step-1>
# Remove NEXTAUTH_SECRET_NEW or keep for next rotation cycle
```

### Step 7: Verify and Clean Up

1. Test login/logout flows
2. Verify no authentication errors in logs
3. Remove the old secret from environment variables
4. Document the rotation date for audit trail

---

## Emergency Rotation (Compromised Secret)

If the secret is compromised, force immediate rotation:

1. Generate new secret (Step 1)
2. Update `NEXTAUTH_SECRET` immediately (no grace period)
3. Deploy
4. **All users will be logged out** and must re-authenticate
5. Notify users if necessary

---

## Rotation Schedule

| Environment | Rotation Frequency | Next Rotation Due |
|-------------|-------------------|-------------------|
| Production  | Every 90 days     | (To be tracked)   |
| Staging     | Every 180 days    | (To be tracked)   |
| Development | As needed         | N/A               |

---

## Automation (Future Enhancement)

Consider implementing:
- Automated secret rotation script (cron job)
- Multi-secret support in auth configuration
- Rotation audit log (store rotation dates in database)
- Alerting when rotation is overdue

---

## References

- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [NIST SP 800-57: Key Management](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf)
