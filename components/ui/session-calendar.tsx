"use client";

import { useState, memo } from "react";
import { DayPicker } from "react-day-picker";
import { format, isSameDay, isToday, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, User, Video, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SessionBooking from "@/components/ui/session-booking";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

interface SessionData {
  id: string;
  title: string;
  subject: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  status: string;
  coach: {
    firstName: string;
    lastName: string;
  } | null;
  type?: string;
}

interface SessionCalendarProps {
  sessions: SessionData[];
  studentId: string;
  parentId?: string;
  userCredits: number;
  className?: string;
  onBookingComplete?: () => void;
}

const SessionCalendarInner = memo(function SessionCalendarInner({ 
  sessions, 
  studentId, 
  parentId, 
  userCredits, 
  className,
  onBookingComplete 
}: SessionCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);

  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  const sessionDates = sessions.map(session => new Date(session.scheduledDate));
  
  const getSessionsForDate = (date: Date) => {
    return sessions.filter(session => 
      isSameDay(new Date(session.scheduledDate), date)
    );
  };

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;
    
    const sessionsOnDate = getSessionsForDate(date);
    if (sessionsOnDate.length > 0) {
      setSelectedDate(date);
      setIsPopoverOpen(true);
    }
  };

  const isSessionScheduledToday = (session: SessionData) => {
    if (!isToday(new Date(session.scheduledDate))) return false;
    
    const now = new Date();
    const sessionDate = new Date(session.scheduledDate);
    const [startHour, startMin] = session.startTime.split(':').map(Number);
    const sessionStart = new Date(sessionDate);
    sessionStart.setHours(startHour, startMin, 0);
    
    const sessionEnd = addMinutes(sessionStart, 60);
    
    return now >= sessionStart && now <= sessionEnd;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SCHEDULED':
      case 'CONFIRMED':
        return 'default';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      case 'IN_PROGRESS':
        return 'popular';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SCHEDULED':
        return 'Planifiée';
      case 'CONFIRMED':
        return 'Confirmée';
      case 'COMPLETED':
        return 'Terminée';
      case 'CANCELLED':
        return 'Annulée';
      case 'IN_PROGRESS':
        return 'En cours';
      default:
        return status;
    }
  };

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  const handleBookingComplete = async () => {
    setIsBookingDialogOpen(false);
    if (onBookingComplete) {
      onBookingComplete();
    }
  };

  return (
    <>
      <Card className={cn("w-full", className)} role="region" aria-label="Calendrier des sessions">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" aria-hidden="true" />
              Calendrier des sessions
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setIsBookingDialogOpen(true)}
              className="flex items-center gap-1"
              aria-label="Réserver une session"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Réserver
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <div className="rdp-container">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onDayClick={handleDayClick}
                disabled={{ before: today }}
                fromDate={today}
                toDate={nextMonth}
                locale={fr}
                modifiers={{
                  scheduled: sessionDates,
                }}
                modifiersClassNames={{
                  scheduled: "rdp-day-scheduled",
                }}
                classNames={{
                  root: "rdp",
                  months: "rdp-months",
                  month: "rdp-month",
                  month_caption: "rdp-caption",
                  caption_label: "rdp-caption_label text-sm font-medium",
                  nav: "rdp-nav",
                  button_previous: "rdp-button_previous",
                  button_next: "rdp-button_next",
                  month_grid: "rdp-month_grid w-full border-collapse",
                  weekdays: "rdp-weekdays",
                  weekday: "rdp-weekday text-xs font-medium text-gray-500",
                  week: "rdp-week",
                  day: "rdp-day p-0 relative",
                  day_button: "rdp-day_button h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md",
                  selected: "bg-brand-primary text-white hover:bg-brand-primary hover:text-white",
                  today: "bg-brand-primary/10 text-brand-primary font-bold",
                  outside: "text-gray-400 opacity-50",
                  disabled: "text-gray-400 opacity-50",
                }}
                aria-label="Calendrier de sélection de date"
              />
            </div>
          </PopoverTrigger>
          {selectedDateSessions.length > 0 && (
            <PopoverContent className="w-80" align="center">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">
                    {selectedDate && format(selectedDate, "d MMMM yyyy")}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {selectedDateSessions.length} session{selectedDateSessions.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-3">
                  {selectedDateSessions.map((session) => (
                    <div
                      key={session.id}
                      className="space-y-2 p-3 rounded-lg border bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium text-sm">{session.title}</p>
                          <p className="text-xs text-gray-600">{session.subject}</p>
                        </div>
                        <Badge variant={getStatusBadgeVariant(session.status)}>
                          {getStatusLabel(session.status)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-gray-600">
                        {session.coach && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" aria-hidden="true" />
                            <span>{session.coach.firstName} {session.coach.lastName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{session.startTime} - {session.endTime}</span>
                        </div>
                      </div>

                      {isSessionScheduledToday(session) && session.status.toUpperCase() === 'SCHEDULED' && (
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            window.location.href = `/session/${session.id}`;
                          }}
                          aria-label={`Rejoindre la session ${session.title}`}
                        >
                          <Video className="h-3 w-3 mr-1" aria-hidden="true" />
                          Rejoindre la session
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          )}
        </Popover>

        <style jsx global>{`
          .rdp-day-scheduled .rdp-day_button {
            background-color: rgb(59 130 246 / 0.1);
            font-weight: 600;
            color: rgb(59 130 246);
            position: relative;
          }
          
          .rdp-day-scheduled .rdp-day_button::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 4px;
            height: 4px;
            background-color: rgb(59 130 246);
            border-radius: 50%;
          }
          
          .rdp-day-scheduled.rdp-selected .rdp-day_button::after {
            background-color: white;
          }

          .rdp-container {
            display: flex;
            justify-content: center;
          }

          .rdp {
            --rdp-accent-color: rgb(59 130 246);
            --rdp-background-color: rgb(59 130 246 / 0.1);
          }
        `}</style>
      </CardContent>
    </Card>

    <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <SessionBooking
          studentId={studentId}
          parentId={parentId}
          userCredits={userCredits}
          onBookingComplete={handleBookingComplete}
        />
      </DialogContent>
    </Dialog>
    </>
  );
})

export function SessionCalendar(props: SessionCalendarProps) {
  return (
    <ErrorBoundary>
      <SessionCalendarInner {...props} />
    </ErrorBoundary>
  )
}
