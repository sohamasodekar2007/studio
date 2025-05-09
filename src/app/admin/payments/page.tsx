'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Banknote, Construction, Search } from "lucide-react"; // Updated icon
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminPaymentsPage() {
  // Placeholder data - replace with actual transaction data fetching
  const transactions = [
    { id: 'txn_1', userId: 'user123', email: 'user@example.com', amount: 499, date: '2024-05-15', status: 'succeeded', item: 'JEE Full Length Pass' },
    { id: 'txn_2', userId: 'user456', email: 'another@example.com', amount: 199, date: '2024-05-14', status: 'succeeded', item: 'MHT-CET Chapterwise Pack' },
    { id: 'txn_3', userId: 'user789', email: 'test@example.com', amount: 999, date: '2024-05-13', status: 'failed', item: 'NEET Combo Subscription' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Manage Payments</h1>
      <p className="text-muted-foreground">View transaction history and manage payment settings (Basic implementation).</p>

       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Overview of recent payments.</CardDescription>
            </div>
            <div className="relative flex-1 md:grow-0 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by email, user ID, item..." className="pl-10" />
            </div>
         </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>User Email</TableHead>
                          <TableHead>Item Purchased</TableHead>
                          <TableHead>Amount (INR)</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {transactions.length > 0 ? transactions.map(tx => (
                          <TableRow key={tx.id}>
                              <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                              <TableCell>{tx.email}</TableCell>
                              <TableCell>{tx.item}</TableCell>
                              <TableCell>₹{tx.amount}</TableCell>
                              <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                  <Badge variant={tx.status === 'succeeded' ? 'default' : 'destructive'} className={tx.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}>
                                      {tx.status}
                                  </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" disabled>Details</Button> {/* Placeholder */}
                              </TableCell>
                          </TableRow>
                      )) : (
                          <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center">No transactions found.</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
            </div>
             {/* TODO: Add Pagination */}
          </CardContent>
       </Card>

      <Card className="text-center mt-8 border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
               <Construction className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="mt-4">Advanced Features Under Construction</CardTitle>
          <CardDescription>Full payment management is currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Future functionality will include:
          </p>
          <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-muted-foreground">
            <li>Payment gateway integration (Stripe, Razorpay).</li>
            <li>Refund processing.</li>
            <li>Subscription management.</li>
            <li>Coupon and discount code configuration.</li>
            <li>Detailed revenue reporting.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

    