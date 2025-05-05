'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart3, Users, BookOpen, Edit3, LineChart } from "lucide-react"; // Added more icons
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, PieChart, Pie, Cell } from 'recharts';

// Placeholder data for charts - Replace with actual data fetching
const userSignupData = [
  { month: 'Jan', users: 120 },
  { month: 'Feb', users: 200 },
  { month: 'Mar', users: 150 },
  { month: 'Apr', users: 280 },
  { month: 'May', users: 190 },
  { month: 'Jun', users: 230 },
];

const testAttemptsData = [
  { name: 'MHT-CET', attempts: 400 },
  { name: 'JEE Main', attempts: 850 },
  { name: 'NEET', attempts: 600 },
  { name: 'JEE Adv', attempts: 150 },
];

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];


export default function AdminAnalyticsPage() {
  // Placeholder stats - replace with real data
  const totalUsers = 1250;
  const totalTests = 55;
  const totalAttempts = 2000;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
            <p className="text-muted-foreground">View usage statistics and performance metrics.</p>
        </div>
        {/* Optional: Add date range picker or filters */}
      </div>

      {/* Key Metrics Widgets */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total registered users</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalTests}</div>
                <p className="text-xs text-muted-foreground">Total tests created</p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
                <Edit3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{totalAttempts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total test attempts by users</p>
            </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
       <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User Signups Over Time</CardTitle>
                    <CardDescription>Monthly user registration trend (Placeholder Data)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userSignupData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="users" fill="hsl(var(--primary))" name="New Users" />
                    </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> Test Attempts by Exam</CardTitle>
                    <CardDescription>Distribution of test attempts across exams (Placeholder Data)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                            data={testAttemptsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="attempts"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                            {testAttemptsData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>

         {/* Placeholder for more advanced analytics */}
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Advanced Analytics (Coming Soon)</CardTitle>
                 <CardDescription>Detailed user engagement, test performance breakdowns, and conversion funnels.</CardDescription>
            </CardHeader>
             <CardContent className="text-center p-10 text-muted-foreground">
                <BarChart3 className="mx-auto h-12 w-12 mb-4" />
                More detailed analytics features are under development.
             </CardContent>
        </Card>

    </div>
  );
}
