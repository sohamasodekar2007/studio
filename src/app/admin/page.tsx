import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Activity, Users, BookOpen, DollarSign } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder data - replace with real data fetching
const stats = {
  totalUsers: 1250,
  activeTests: 55,
  recentSignups: 25,
  totalRevenue: 500, // Example if paid tests exist
};

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <p className="text-muted-foreground">Overview of platform activity and management tools.</p>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTests}</div>
            <p className="text-xs text-muted-foreground">Available tests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Signups (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.recentSignups}</div>
            <p className="text-xs text-muted-foreground">New users today</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From paid tests (Example)</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage key areas of the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           <Link href="/admin/users" passHref>
              <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" /> Manage Users
              </Button>
           </Link>
           <Link href="/admin/tests" passHref>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <BookOpen className="h-4 w-4" /> Manage Tests
               </Button>
           </Link>
           <Button variant="outline" className="w-full justify-start gap-2" disabled>
             <Activity className="h-4 w-4" /> View Analytics (Coming Soon)
           </Button>
            <Button variant="outline" className="w-full justify-start gap-2" disabled>
              <DollarSign className="h-4 w-4" /> Manage Payments (Coming Soon)
           </Button>
           {/* Add more actions as needed */}
        </CardContent>
      </Card>

      {/* Other potential sections: Recent Activity Feed, System Status, etc. */}

    </div>
  );
}
