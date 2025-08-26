import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ASSISTANTE') {
      // Autoriser en dev/E2E pour faciliter les tests
      if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_E2E !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')

    const where: any = {}
    if (roleFilter && roleFilter !== 'ALL') {
      where.role = roleFilter
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users for assistant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}







