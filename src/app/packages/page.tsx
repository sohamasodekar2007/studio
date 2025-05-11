// src/app/packages/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Star, Zap, Sparkles, ShoppingBag, BookOpen, ListChecks, FileClock, Repeat, BadgeCheck, Gem } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PackageDetail {
  id: 'chapterwise' | 'full_length' | 'combo' | 'pyq';
  name: string;
  price: number;
  description: string;
  features: string[];
  icon: React.ElementType;
  primaryActionText: string;
  actionLink?: string; // Optional: for external payment pages
  highlight?: boolean;
}

const allPackages: PackageDetail[] = [
  {
    id: 'chapterwise',
    name: 'Chapterwise Mastery',
    price: 600,
    description: 'Focus your preparation with unlimited access to all chapter-specific tests.',
    features: [
      'All Chapter-wise Tests',
      'Detailed Solutions',
      'Performance Analysis per Chapter',
      'Regular DPP Access',
    ],
    icon: BookOpen,
    primaryActionText: 'Get Chapterwise Plan',
  },
  {
    id: 'full_length',
    name: 'Full-Length Pro',
    price: 500,
    description: 'Simulate the real exam experience with our comprehensive full-length mock tests.',
    features: [
      'All Full-Length Mock Tests',
      'Real Exam Interface Simulation',
      'Overall Preparedness Assessment',
      'Regular DPP Access',
    ],
    icon: ListChecks,
    primaryActionText: 'Get Full-Length Plan',
  },
  {
    id: 'combo',
    name: 'Combo Ultimate',
    price: 1000,
    description: 'The complete package for ultimate exam readiness. Access everything!',
    features: [
      'All Chapter-wise Tests',
      'All Full-Length Mock Tests',
      'All PYQ DPPs (Including Latest Year)',
      'Priority Support',
      'Exclusive Content (Coming Soon)',
    ],
    icon: Zap,
    primaryActionText: 'Get Combo Plan',
    highlight: true,
  },
  {
    id: 'pyq',
    name: 'Latest PYQ Access',
    price: 349,
    description: 'Stay ahead with access to the most recent Previous Year Questions and DPPs.',
    features: [
      'Latest Year PYQs',
      'All Past Year PYQ DPPs',
      'Understand Current Exam Trends',
      'Essential for Final Revision',
    ],
    icon: Repeat,
    primaryActionText: 'Get PYQ Access',
  },
];

export default function PackagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
      if (!user) {
        router.push('/auth/login?redirect=/packages');
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-2/3 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return null; // Should be redirected by useEffect

  const currentPlan = user.model;
  let availablePackages: PackageDetail[] = [];

  if (currentPlan === 'combo') {
    // Combo users see a special message and only PYQ as a potential add-on
    // (assuming PYQ isn't automatically part of combo based on previous prompt,
    // but "Access everything" in combo description implies it might be. Let's adjust)
    // For combo, let's assume PYQ is included, so they have everything.
  } else if (currentPlan === 'free') {
    availablePackages = allPackages.filter(p => p.id !== 'pyq'); // Show core plans
    availablePackages.push(allPackages.find(p => p.id === 'pyq')!); // Add PYQ separately
  } else if (currentPlan === 'chapterwise') {
    availablePackages = allPackages.filter(p => p.id === 'full_length' || p.id === 'combo' || p.id === 'pyq');
  } else if (currentPlan === 'full_length') {
    availablePackages = allPackages.filter(p => p.id === 'chapterwise' || p.id === 'combo' || p.id === 'pyq');
  } else {
    // Fallback for any other new/unhandled plan type
    availablePackages = allPackages;
  }
  
  // Remove PYQ from availablePackages if combo includes it
  if (currentPlan === 'combo') {
    availablePackages = availablePackages.filter(p => p.id !== 'pyq');
  }


  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      <header className="text-center">
        <ShoppingBag className="h-16 w-16 text-primary mx-auto mb-3" />
        <h1 className="text-4xl font-extrabold tracking-tight">EduNexus Subscription Plans</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Choose the perfect plan to supercharge your exam preparation.
        </p>
      </header>

      {currentPlan === 'combo' ? (
        <Card className="text-center bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary shadow-xl">
          <CardHeader>
            <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-3">
                <Gem className="h-10 w-10 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Congratulations, {user.name}!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-foreground">
              You have the <strong>Combo Ultimate Plan</strong>, which includes access to all our core test series and PYQ DPPs.
            </p>
            <p className="text-muted-foreground mt-2">You're all set for comprehensive preparation!</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/tests">Start Practicing</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          {availablePackages.length === 0 && currentPlan !== 'free' && (
            <Alert variant="default" className="bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700">
              <BadgeCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-700 dark:text-green-300">You're Covered!</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Your current plan already includes access to the best available features. Consider upgrading to Combo for everything!
              </AlertDescription>
            </Alert>
          )}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${availablePackages.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
            {availablePackages.map((pkg) => (
              <Card key={pkg.id} className={`flex flex-col hover:shadow-xl transition-all duration-300 ease-in-out ${pkg.highlight ? 'border-2 border-primary ring-2 ring-primary/20 shadow-primary/10' : 'border-border'}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <pkg.icon className={`h-8 w-8 ${pkg.highlight ? 'text-primary' : 'text-accent'}`} />
                    <CardTitle className={`text-xl font-bold ${pkg.highlight ? 'text-primary' : 'text-foreground'}`}>{pkg.name}</CardTitle>
                  </div>
                  <CardDescription className="text-sm min-h-[40px]">{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <p className="text-3xl font-extrabold text-foreground">
                    ₹{pkg.price}
                    <span className="text-xs font-normal text-muted-foreground"> / year</span>
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                   {/* Placeholder for referral discount - this logic needs to be properly implemented */}
                   {/* {user.referralStats && (user.referralStats.referred_combo > 0 || user.referralStats.referred_full_length > 0) && pkg.id !== 'pyq' && (
                    <p className="text-xs text-green-600 font-medium mt-2">✨ Eligible for referral discount! ✨</p>
                   )} */}
                </CardContent>
                <CardFooter className="mt-auto pt-4">
                  <Button className={`w-full ${pkg.highlight ? '' : 'bg-accent hover:bg-accent/90 text-accent-foreground'}`} disabled> {/* Payment out of scope */}
                    <ShoppingBag className="mr-2 h-4 w-4" /> {pkg.primaryActionText}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}
       <p className="text-center text-xs text-muted-foreground mt-8">
        All prices are inclusive of applicable taxes. Subscriptions are typically for a one-year period.
        For support, contact <a href="mailto:support@edunexus.com" className="underline hover:text-primary">support@edunexus.com</a>.
      </p>
    </div>
  );
}
