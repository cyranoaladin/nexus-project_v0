"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, isSameDay, isToday, addMinutes } from "date-fns";
import { Calendar, Clock, User, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  className?: string;
}

export function SessionCalendar({ sessions, className }: SessionCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendrier des sessions
        </CardTitle>
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
                            <User className="h-3 w-3" />
                            <span>{session.coach.firstName} {session.coach.lastName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
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
                        >
                          <Video className="h-3 w-3 mr-1" />
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
  );
}
