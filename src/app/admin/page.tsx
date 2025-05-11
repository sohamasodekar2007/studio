
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Activity, Users, BookOpen, DollarSign, ClipboardList, FileText, LineChart, Edit, PlusCircle, Gift } from "lucide-react"; // Added Gift icon
import Link from "next/link";
import { Button } from "@/components/ui/button";
// Removed getTests import as it's obsolete
import { readUsers } from "@/actions/user-actions";
// TODO: Add action to count generated tests later
// import { countGeneratedTests } from '@/actions/generated-test-actions'; // Assuming this action exists

// Placeholder data fetching - replace with more robust fetching logic
async function getStats() {
    // In a real app, fetch this from a database or analytics service
    try {
        // Removed getTests call
        // const [users, tests] = await Promise.all([readUsers(), getTests()]);
        const users = await readUsers();
        // TODO: Fetch actual count of generated tests
        const generatedTestCount = 0; // Placeholder
        const totalUsers = users.length;
        // const activeTests = tests.filter(t => t.published).length; // This logic is now obsolete
        const activeTests = generatedTestCount; // Use generated test count
        // Placeholder for recent signups and revenue
        const recentSignups = users.filter(u => u.createdAt && new Date(u.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;
        const totalRevenue = 500; // Example

        return {
            totalUsers,
            activeTests, // Represents total generated tests now
            recentSignups,
            totalRevenue,
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return {
            totalUsers: 0,
            activeTests: 0,
            recentSignups: 0,
            totalRevenue: 0,
        };
    }
}

export default async function AdminDashboardPage() {
    const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">EduNexus Admin Dashboard</h1> {/* Updated Title */}
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
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle> {/* Changed label */}
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTests}</div>
            <p className="text-xs text-muted-foreground">Generated tests</p> {/* Changed description */}
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
           <Link href="/admin/users" passHref legacyBehavior>
              <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="h-4 w-4" /> Manage Users
              </Button>
           </Link>
           {/* Updated link to new Test Management page */}
           <Link href="/admin/tests/manage" passHref legacyBehavior>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <BookOpen className="h-4 w-4" /> Manage Tests
               </Button>
           </Link>
            {/* New Create Test Button */}
             <Link href="/admin/tests/create" passHref legacyBehavior>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <PlusCircle className="h-4 w-4" /> Create Test
               </Button>
           </Link>
            <Link href="/admin/questions" passHref legacyBehavior>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <ClipboardList className="h-4 w-4" /> Add Question
               </Button>
           </Link>
            {/* New Edit Questions Button */}
            <Link href="/admin/questions/edit" passHref legacyBehavior>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <Edit className="h-4 w-4" /> Edit Questions
               </Button>
           </Link>
            <Link href="/admin/notes" passHref legacyBehavior>
               <Button variant="outline" className="w-full justify-start gap-2">
                   <FileText className="h-4 w-4" /> Short Notes
               </Button>
           </Link>
           <Link href="/admin/analytics" passHref legacyBehavior>
                <Button variant="outline" className="w-full justify-start gap-2">
                <LineChart className="h-4 w-4" /> View Analytics
                </Button>
            </Link>
            <Link href="/admin/payments" passHref legacyBehavior>
                <Button variant="outline" className="w-full justify-start gap-2">
                <DollarSign className="h-4 w-4" /> Manage Payments
                </Button>
           </Link>
           <Link href="/admin/referrals" passHref legacyBehavior>
                <Button variant="outline" className="w-full justify-start gap-2">
                <Gift className="h-4 w-4" /> Manage Referrals
                </Button>
           </Link>
           {/* Add more actions as needed */}
        </CardContent>
      </Card>

      {/* Other potential sections: Recent Activity Feed, System Status, etc. */}

    </div>
  );
}

