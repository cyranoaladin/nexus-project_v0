import { authOptions } from '@/lib/auth';
import { generateBilan } from '@/lib/bilan';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const generateSchema = z.object({
  audience: z.enum(['STUDENT', 'PARENT', 'ASSISTANTE']),
  studentName: z.string().min(1),
  level: z.string().min(1),
  context: z.string().min(1),
  subjects: z.array(z.object({
    name: z.string(),
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(z.string()).default([]),
    goals: z.array(z.string()).default([])
  })).min(1)
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = generateSchema.parse(body);

    const content = await generateBilan(data.audience, {
      studentName: data.studentName,
      level: data.level,
      subjects: data.subjects,
      context: data.context
    });

    return NextResponse.json({ success: true, content });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to generate bilan' }, { status: 500 });
  }
}

