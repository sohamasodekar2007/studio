// src/app/referrals/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, Gift, Users, Share2, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { readUsers, getUserById } from '@/actions/user-actions'; // Assuming getUserById can fetch limited profile
import { getReferralOffers } from '@/actions/referral-offers-actions'; // Action to fetch offers
import type { UserProfile, ReferralOffer, UserReferralStats } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function ReferralsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<UserReferralStats | null>(null);
  const [activeOffers, setActiveOffers] = useState<ReferralOffer[]>([]);
  const [referredUsers, setReferredUsers] = useState<Omit<UserProfile, 'password'>[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/referrals');
      return;
    }

    if (user?.id) {
      setIsLoading(true);
      Promise.all([
        getUserById(user.id), // To get the user's own referral code and stats
        getReferralOffers(true), // Fetch only active offers
        readUsers() // Fetch all users to find who was referred by the current user
      ]).then(([currentUserProfile, offers, allUsers]) => {
        if (currentUserProfile) {
          setReferralCode(currentUserProfile.referralCode || null);
          setReferralStats(currentUserProfile.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 });
          
          const myReferrals = allUsers.filter(
            u => u.referredByCode === currentUserProfile.referralCode && u.id !== currentUserProfile.id
          );
          setReferredUsers(myReferrals);
        }
        setActiveOffers(offers);
      }).catch(err => {
        console.error("Failed to load referral data:", err);
        toast({ variant: "destructive", title: "Error", description: "Could not load referral information." });
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [user, authLoading, router, toast]);

  const handleCopyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode)
        .then(() => {
          setCopied(true);
          toast({ title: "Copied!", description: "Referral code copied to clipboard." });
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy referral code." });
        });
    }
  };

  const shareableLink = useMemo(() => {
    if (typeof window !== 'undefined' && referralCode) {
      return `${window.location.origin}/auth/signup/${referralCode}`;
    }
    return '';
  }, [referralCode]);

  const handleShare = () => {
    if (navigator.share && shareableLink) {
      navigator.share({
        title: 'Join EduNexus!',
        text: `Join EduNexus using my referral code ${referralCode} and get exciting benefits!`,
        url: shareableLink,
      }).catch((error) => console.log('Error sharing', error));
    } else if (shareableLink) {
        navigator.clipboard.writeText(shareableLink)
        .then(() => {
          toast({ title: "Link Copied!", description: "Shareable signup link copied to clipboard." });
        })
        .catch(err => {
          toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy shareable link." });
        });
    }
  };

  const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : '?';

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="text-center">
        <Gift className="h-12 w-12 text-primary mx-auto mb-2" />
        <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
        <p className="text-muted-foreground">Share EduNexus with friends and earn rewards!</p>
      </div>

      <Tabs defaultValue="myCode">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="myCode">My Referral Code</TabsTrigger>
          <TabsTrigger value="myReferrals">My Referrals ({referredUsers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="myCode">
          <Card>
            <CardHeader>
              <CardTitle>Your Unique Referral Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {referralCode ? (
                <>
                  <div className="flex items-center space-x-2">
                    <Input value={referralCode} readOnly className="font-mono text-lg h-11 flex-grow" />
                    <Button variant="outline" size="icon" onClick={handleCopyReferralCode} disabled={!referralCode}>
                      {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Share this code with your friends. When they sign up using your code, you both might get rewards based on current offers!</p>
                  
                  {shareableLink && (
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="share-link">Shareable Signup Link</Label>
                         <div className="flex items-center space-x-2">
                            <Input id="share-link" value={shareableLink} readOnly className="text-xs h-9 flex-grow" />
                             <Button variant="outline" size="sm" onClick={handleShare} className="h-9">
                                <Share2 className="mr-2 h-4 w-4"/> Share Link
                            </Button>
                        </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Your referral code is being generated. Please check back shortly.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Referral Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {referralStats ? (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Free Users</p>
                    <p className="text-xl font-semibold">{referralStats.referred_free}</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Chapterwise</p>
                    <p className="text-xl font-semibold">{referralStats.referred_chapterwise}</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Full Length</p>
                    <p className="text-xl font-semibold">{referralStats.referred_full_length}</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Combo</p>
                    <p className="text-xl font-semibold">{referralStats.referred_combo}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No referral statistics available yet.</p>
              )}
            </CardContent>
          </Card>

        </TabsContent>
        <TabsContent value="myReferrals">
            <Card>
                <CardHeader>
                    <CardTitle>Users You Referred</CardTitle>
                    <CardDescription>See who signed up using your referral code.</CardDescription>
                </CardHeader>
                <CardContent>
                    {referredUsers.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No one has signed up using your code yet.</p>
                    ) : (
                        <ul className="space-y-3 max-h-80 overflow-y-auto">
                            {referredUsers.map(refUser => (
                                <li key={refUser.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={refUser.avatarUrl ? `/avatars/${refUser.avatarUrl}` : `https://avatar.vercel.sh/${refUser.email || refUser.id}.png`} />
                                            <AvatarFallback>{getInitials(refUser.name)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{refUser.name || 'User'}</p>
                                            <p className="text-xs text-muted-foreground">Joined: {refUser.createdAt ? new Date(refUser.createdAt).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="capitalize">{refUser.model}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>


      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Current Referral Offers</CardTitle>
          <CardDescription>Check out the active referral promotions.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeOffers.length > 0 ? (
            <div className="space-y-4">
              {activeOffers.map(offer => (
                <div key={offer.id} className="p-4 border rounded-lg bg-primary/5">
                  <h3 className="font-semibold text-primary">{offer.name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">{offer.description}</p>
                  <p className="text-xs"><strong>Referrer Gets:</strong> {offer.benefitsForReferrer}</p>
                  <p className="text-xs"><strong>Referred Friend Gets:</strong> {offer.benefitsForReferred}</p>
                  {offer.expiryDate && <p className="text-xs mt-1 text-destructive">Expires: {new Date(offer.expiryDate).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No active referral offers at the moment. Check back later!</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}