'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign, Construction } from "lucide-react";

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Manage Payments</h1>
      <p className="text-muted-foreground">View transaction history and manage payment settings (Coming Soon).</p>

      <Card className="text-center">
        <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
               <Construction className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Payment management features are currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will allow you to:
          </p>
          <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-muted-foreground">
            <li>View transaction history for paid tests.</li>
            <li>Manage payment gateway integrations (e.g., Stripe, Razorpay).</li>
            <li>Handle refunds or disputes (if applicable).</li>
            <li>Configure pricing plans or coupons.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
