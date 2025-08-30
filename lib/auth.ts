import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcryptjs from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

// Generate a secure secret if not provided
const generateSecret = () => {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }
  // In production we must not run without a configured secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is required in production environment');
  }
  // Generate a random secret for development only
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: generateSecret(),
  debug:
    process.env.NODE_ENV === 'development' &&
    process.env.E2E !== '1' &&
    process.env.E2E_RUN !== '1' &&
    process.env.NEXT_PUBLIC_E2E !== '1',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (user && user.password) {
            const isPasswordValid = await bcryptjs.compare(credentials.password, user.password);

            if (isPasswordValid) {
              return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
              };
            }
          }
        } catch (error) {
          console.error('[AUTHORIZE ERROR]', error);
          // Au lieu de retourner null, on lance une erreur pour que le client soit notifié
          throw new Error('An internal error occurred during authentication.');
        }
        // Si on arrive ici, c'est que l'utilisateur n'a pas été trouvé ou que le mdp est invalide
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;

        // Si l'utilisateur est un élève, on cherche son profil pour récupérer les IDs
        if (user.role === UserRole.ELEVE) {
          const studentProfile = await prisma.student.findUnique({
            where: { userId: user.id },
            select: { id: true, parentId: true },
          });
          if (studentProfile) {
            token.studentId = studentProfile.id;
            token.parentId = studentProfile.parentId;
          }
        }
        
        // Si l'utilisateur est un parent, on cherche le premier élève associé pour simplifier l'accès
        if (user.role === UserRole.PARENT) {
          const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId: user.id },
            include: {
              children: {
                select: { id: true },
                take: 1, // On ne prend que le premier élève
              },
            },
          });
          if (parentProfile) {
            token.parentId = parentProfile.id;
            if (parentProfile.children && parentProfile.children.length > 0) {
              token.studentId = parentProfile.children[0].id;
            }
          }
        }
      }
      // Support tokens created externally (e.g., E2E) where `sub` exists but `id` is missing
      if (!('id' in token) && token?.sub) {
        (token as any).id = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = ((token as any).id || (token as any).sub) as string;
        session.user.role = token.role as UserRole;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        // On ajoute les IDs à la session
        session.user.studentId = token.studentId as string | null;
        session.user.parentId = token.parentId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
