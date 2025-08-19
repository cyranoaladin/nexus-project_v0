"use client";


interface AnalyticsData {
  period: string;
  summary: {
    totalRevenue: number;
    totalUsers: number;
    totalSessions: number;
    totalSubscriptions: number;
  };
  revenueData: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  userGrowthData: Array<{
    date: string;
    role: string;
    count: number;
  }>;
  sessionData: Array<{
    date: string;
    status: string;
    count: number;
  }>;
  subscriptionData: Array<{
    date: string;
    status: string;
    count: number;
  }>;
  creditData: Array<{
    date: string;
    type: string;
    amount: number;
    count: number;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    status: string;
    studentName: string;
    coachName: string;
    subject: string;
    action: string;
  }>;
}

export default function AdminAnalyticsPage() {
  return (
    <div>
      <h1>Analytics</h1>
      <p>Cette page est en cours de construction.</p>
    </div>
  );
}
