import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;

    // Fetch resources available to the student
    const resources = await prisma.resource.findMany({
      where: {
        OR: [
          { isPublic: true },
          { 
            studentResources: {
              some: {
                student: {
                  userId: studentId
                }
              }
            }
          }
        ]
      },
      include: {
        subject: true,
        downloads: {
          where: {
            student: {
              userId: studentId
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedResources = resources.map((resource: any) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      subject: resource.subject.name,
      type: resource.type,
      fileUrl: resource.fileUrl,
      thumbnailUrl: resource.thumbnailUrl,
      downloads: resource.downloads.length,
      lastUpdated: resource.updatedAt,
      isDownloaded: resource.downloads.length > 0
    }));

    return NextResponse.json(formattedResources);

  } catch (error) {
    console.error('Error fetching student resources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 