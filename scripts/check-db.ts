import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.parentProfile.count(),
    prisma.student.count(),
    prisma.coachProfile.count(),
    prisma.subscription.count(),
    prisma.payment.count(),
    prisma.session.count(),
    prisma.pedagogicalContent.count(),
    prisma.ariaConversation.count(),
    prisma.ariaMessage.count(),
    prisma.notification.count(),
    prisma.sessionBooking.count(),
  ])

  const [users, parents, students, coaches, subs, payments, sessions, contents, convs, msgs, notifs, bookings] = counts
  console.log('DB summary:')
  console.log({ users, parents, students, coaches, subs, payments, sessions, contents, convs, msgs, notifs, bookings })

  // Fetch samples
  const sampleUsers = await prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
  const sampleStudents = await prisma.student.findMany({ take: 5, include: { user: true, subscriptions: true } })
  const sampleSubs = await prisma.subscription.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
  const samplePayments = await prisma.payment.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
  const sampleSessions = await prisma.session.findMany({ take: 5, orderBy: { createdAt: 'desc' } })

  console.log('\nSamples:')
  console.log('Users:', sampleUsers.map(u => ({ id: u.id, email: u.email, role: u.role })))
  console.log('Students:', sampleStudents.map(s => ({ id: s.id, name: `${s.user?.firstName} ${s.user?.lastName}`, subs: s.subscriptions.length })))
  console.log('Subscriptions:', sampleSubs.map(s => ({ id: s.id, plan: s.planName, status: s.status })))
  console.log('Payments:', samplePayments.map(p => ({ id: p.id, type: p.type, status: p.status, amount: p.amount })))
  console.log('Sessions:', sampleSessions.map(s => ({ id: s.id, subject: s.subject, status: s.status })))
}

main().finally(() => prisma.$disconnect())

