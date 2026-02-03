"use client";

import { SessionCalendar } from "@/components/ui/session-calendar";
import { useRouter } from "next/navigation";
import { memo } from "react";

interface SessionData {
  id: string;
  title: string;
  subject: string;
  scheduledAt: string;
  status: string;
  coach: {
    firstName: string;
    lastName: string;
  } | null;
}

interface StudentCalendarWrapperProps {
  sessions: SessionData[];
  studentId: string;
  parentId?: string;
  userCredits: number;
}

export const StudentCalendarWrapper = memo(function StudentCalendarWrapper({
  sessions,
  studentId,
  parentId,
  userCredits,
}: StudentCalendarWrapperProps) {
  const router = useRouter();

  const transformedSessions = sessions.map((session) => {
    const scheduledDate = new Date(session.scheduledAt);
    
    return {
      id: session.id,
      title: session.title,
      subject: session.subject,
      scheduledDate: scheduledDate,
      startTime: scheduledDate.toTimeString().substring(0, 5),
      endTime: new Date(scheduledDate.getTime() + 60 * 60 * 1000).toTimeString().substring(0, 5),
      status: session.status,
      coach: session.coach,
    };
  });

  const handleBookingComplete = () => {
    router.refresh();
  };

  return (
    <SessionCalendar
      sessions={transformedSessions}
      studentId={studentId}
      parentId={parentId}
      userCredits={userCredits}
      onBookingComplete={handleBookingComplete}
    />
  );
})
