// src/app/admin/referrals/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon, Loader2, PlusCircle, Edit, Trash2, Users, Gift, Search, ArrowUpDown, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { readUsers } from '@/actions/user-actions';
import { getReferralOffers, createReferralOffer, updateReferralOffer, deleteReferralOffer } from '@/actions/referral-offers-actions';
import type { UserProfile, ReferralOffer, UserReferralStats } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type SortKey = 'user' | 'referralCode' | 'referred_free' | 'referred_chapterwise' | 'referred_full_length' | 'referred_combo' | 'referredBy' | 'signupDate';
type SortOrder = 'asc' | 'desc';

export default function AdminReferralsPage() {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<Omit<UserProfile, 'password'>[]>([]);
  const [allOffers, setAllOffers] = useState<ReferralOffer[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [isDeletingOffer, setIsDeletingOffer] = useState<string | null>(null);
  
  const [searchTermUsers, setSearchTermUsers] = useState('');
  const [searchTermReferrals, setSearchTermReferrals] = useState('');
  const [searchTermOffers, setSearchTermOffers] = useState('');

  const [editingOffer, setEditingOffer] = useState<ReferralOffer | null>(null);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; order: SortOrder }>({ key: 'user', order: 'asc' });
  const [referralSortConfig, setReferralSortConfig] = useState<{ key: SortKey; order: SortOrder }>({ key: 'signupDate', order: 'desc' });


  const fetchAllData = useCallback(async () => {
    setIsLoadingUsers(true);
    setIsLoadingOffers(true);
    try {
      const [usersData, offersData] = await Promise.all([
        readUsers(),
        getReferralOffers(),
      ]);
      setAllUsers(usersData);
      setAllOffers(offersData);
    } catch (error) {
      console.error("Failed to load admin referral data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load referral data." });
    } finally {
      setIsLoadingUsers(false);
      setIsLoadingOffers(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Offer Management ---
  const handleOpenOfferDialog = (offer?: ReferralOffer) => {
    setEditingOffer(offer || null);
    setIsOfferDialogOpen(true);
  };

  const handleOfferSubmit = async (formData: Omit<ReferralOffer, 'id' | 'createdAt'>) => {
    setIsSubmittingOffer(true);
    try {
      const result = editingOffer
        ? await updateReferralOffer(editingOffer.id, formData)
        : await createReferralOffer(formData);
      if (result.success) {
        toast({ title: editingOffer ? "Offer Updated" : "Offer Created", description: `Offer "${formData.name}" has been saved.` });
        setIsOfferDialogOpen(false);
        setEditingOffer(null);
        fetchAllData(); // Refresh offers
      } else {
        throw new Error(result.message || "Failed to save offer.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    setIsDeletingOffer(offerId);
    try {
      const result = await deleteReferralOffer(offerId);
      if (result.success) {
        toast({ title: "Offer Deleted" });
        fetchAllData(); // Refresh offers
      } else {
        throw new Error(result.message || "Failed to delete offer.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: error.message });
    } finally {
      setIsDeletingOffer(null);
    }
  };


  const filteredUsers = useMemo(() => {
    let sortedUsers = [...allUsers];
    if (sortConfig.key) {
      sortedUsers.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
          case 'user':
            valA = a.name || a.email || '';
            valB = b.name || b.email || '';
            break;
          case 'referralCode':
            valA = a.referralCode || '';
            valB = b.referralCode || '';
            break;
          default: // Stats keys
            valA = a.referralStats?.[sortConfig.key as keyof UserReferralStats] ?? 0;
            valB = b.referralStats?.[sortConfig.key as keyof UserReferralStats] ?? 0;
            break;
        }
        
        if (typeof valA === 'string' && typeof valB === 'string') {
           return sortConfig.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortConfig.order === 'asc' ? valA - valB : valB - valA;
      });
    }

    return sortedUsers.filter(user =>
      (user.name?.toLowerCase() || '').includes(searchTermUsers.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTermUsers.toLowerCase()) ||
      (user.referralCode?.toLowerCase() || '').includes(searchTermUsers.toLowerCase())
    );
  }, [allUsers, searchTermUsers, sortConfig]);


  const usersWithReferrers = useMemo(() => {
    const usersMap = new Map(allUsers.map(u => [u.referralCode, u.name || u.email]));
    let sortedReferrals = allUsers.filter(u => u.referredByCode);

    if (referralSortConfig.key) {
        sortedReferrals.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            switch (referralSortConfig.key) {
                case 'user':
                    valA = a.name || a.email || '';
                    valB = b.name || b.email || '';
                    break;
                case 'referredBy':
                    valA = usersMap.get(a.referredByCode!) || '';
                    valB = usersMap.get(b.referredByCode!) || '';
                    break;
                case 'signupDate':
                    valA = new Date(a.createdAt || 0).getTime();
                    valB = new Date(b.createdAt || 0).getTime();
                    break;
                default: break;
            }
             if (typeof valA === 'string' && typeof valB === 'string') {
               return referralSortConfig.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return referralSortConfig.order === 'asc' ? valA - valB : valB - valA;
        });
    }


    return sortedReferrals.filter(user =>
      (user.name?.toLowerCase() || '').includes(searchTermReferrals.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTermReferrals.toLowerCase()) ||
      (user.referredByCode?.toLowerCase() || '').includes(searchTermReferrals.toLowerCase()) ||
      (usersMap.get(user.referredByCode!)?.toLowerCase() || '').includes(searchTermReferrals.toLowerCase())
    );
  }, [allUsers, searchTermReferrals, referralSortConfig]);

  const filteredOffers = useMemo(() => {
    return allOffers.filter(offer =>
      offer.name.toLowerCase().includes(searchTermOffers.toLowerCase()) ||
      offer.description.toLowerCase().includes(searchTermOffers.toLowerCase())
    );
  }, [allOffers, searchTermOffers]);

  const requestSort = (key: SortKey) => {
    let order: SortOrder = 'asc';
    if (sortConfig.key === key && sortConfig.order === 'asc') {
      order = 'desc';
    }
    setSortConfig({ key, order });
  };
  const requestReferralSort = (key: SortKey) => {
    let order: SortOrder = 'asc';
    if (referralSortConfig.key === key && referralSortConfig.order === 'asc') {
      order = 'desc';
    }
    setReferralSortConfig({ key, order });
  };

  const getSortIcon = (key: SortKey, currentSortConfig: {key: SortKey, order: SortOrder}) => {
    if (currentSortConfig.key !== key) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return currentSortConfig.order === 'asc' ? '🔼' : '🔽';
  };


  if (isLoadingUsers || isLoadingOffers) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-2/3" />
        <Card><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }
  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Referral System Management</h1>
      </div>

      <Tabs defaultValue="codes">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="codes">User Codes & Stats</TabsTrigger>
          <TabsTrigger value="tracking">Referral Tracking</TabsTrigger>
          <TabsTrigger value="offers">Manage Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="codes">
          <Card>
            <CardHeader>
              <CardTitle>User Referral Codes & Statistics</CardTitle>
              <CardDescription>Overview of user referral codes and their performance.</CardDescription>
              <Input placeholder="Search users, emails, codes..." value={searchTermUsers} onChange={e => setSearchTermUsers(e.target.value)} className="mt-2 max-w-sm"/>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestSort('user')} className="cursor-pointer hover:bg-muted/50">User {getSortIcon('user', sortConfig)}</TableHead>
                      <TableHead onClick={() => requestSort('referralCode')} className="cursor-pointer hover:bg-muted/50">Referral Code {getSortIcon('referralCode', sortConfig)}</TableHead>
                      <TableHead onClick={() => requestSort('referred_free')} className="text-center cursor-pointer hover:bg-muted/50">Free {getSortIcon('referred_free', sortConfig)}</TableHead>
                      <TableHead onClick={() => requestSort('referred_chapterwise')} className="text-center cursor-pointer hover:bg-muted/50">Chapter {getSortIcon('referred_chapterwise', sortConfig)}</TableHead>
                      <TableHead onClick={() => requestSort('referred_full_length')} className="text-center cursor-pointer hover:bg-muted/50">Full {getSortIcon('referred_full_length', sortConfig)}</TableHead>
                      <TableHead onClick={() => requestSort('referred_combo')} className="text-center cursor-pointer hover:bg-muted/50">Combo {getSortIcon('referred_combo', sortConfig)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || user.email}</TableCell>
                        <TableCell className="font-mono text-xs">{user.referralCode || 'N/A'}</TableCell>
                        <TableCell className="text-center">{user.referralStats?.referred_free || 0}</TableCell>
                        <TableCell className="text-center">{user.referralStats?.referred_chapterwise || 0}</TableCell>
                        <TableCell className="text-center">{user.referralStats?.referred_full_length || 0}</TableCell>
                        <TableCell className="text-center">{user.referralStats?.referred_combo || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
           <Card>
            <CardHeader>
              <CardTitle>Referral Tracking</CardTitle>
              <CardDescription>View who referred whom and their current plan.</CardDescription>
              <Input placeholder="Search referred user, referrer, code..." value={searchTermReferrals} onChange={e => setSearchTermReferrals(e.target.value)} className="mt-2 max-w-sm"/>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => requestReferralSort('user')} className="cursor-pointer hover:bg-muted/50">Referred User {getSortIcon('user', referralSortConfig)}</TableHead>
                      <TableHead onClick={() => requestReferralSort('referredBy')} className="cursor-pointer hover:bg-muted/50">Referred By {getSortIcon('referredBy', referralSortConfig)}</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead onClick={() => requestReferralSort('signupDate')} className="cursor-pointer hover:bg-muted/50">Signup Date {getSortIcon('signupDate', referralSortConfig)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithReferrers.map(user => {
                       const referrer = allUsers.find(u => u.referralCode === user.referredByCode);
                       return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name || user.email}</TableCell>
                            <TableCell>{referrer ? (referrer.name || referrer.email) : user.referredByCode}</TableCell>
                            <TableCell><Badge variant="secondary" className="capitalize">{user.model}</Badge></TableCell>
                            <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                          </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <div>
                    <CardTitle>Manage Referral Offers</CardTitle>
                    <CardDescription>Create, edit, or delete referral promotions.</CardDescription>
                </div>
                <Button onClick={() => handleOpenOfferDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Create Offer</Button>
            </CardHeader>
            <CardContent>
              <Input placeholder="Search offers by name or description..." value={searchTermOffers} onChange={e => setSearchTermOffers(e.target.value)} className="mb-4 max-w-sm"/>
              <ScrollArea className="h-[60vh]">
                 {filteredOffers.length === 0 ? (
                     <p className="text-muted-foreground text-center py-6">No referral offers found.</p>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredOffers.map(offer => (
                            <Card key={offer.id} className={cn(!offer.isActive && "opacity-60 border-dashed")}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{offer.name}
                                      <Badge variant={offer.isActive ? "default" : "outline"} className={cn("ml-2", offer.isActive ? "bg-green-500" : "bg-gray-400 text-white")}>
                                        {offer.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                    </CardTitle>
                                    <CardDescription>{offer.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1">
                                    <p><strong>Referrer Gets:</strong> {offer.benefitsForReferrer}</p>
                                    <p><strong>Referred Gets:</strong> {offer.benefitsForReferred}</p>
                                    <p><strong>Expires:</strong> {offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString() : "Never"}</p>
                                    <p className="text-muted-foreground">Created: {new Date(offer.createdAt).toLocaleDateString()}</p>
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenOfferDialog(offer)}><Edit className="mr-1 h-3 w-3"/>Edit</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm" disabled={isDeletingOffer === offer.id}>
                                                {isDeletingOffer === offer.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="mr-1 h-3 w-3"/>} Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Offer?</AlertDialogTitle>
                                                <AlertDialogDescription>Are you sure you want to delete the offer "{offer.name}"? This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteOffer(offer.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                 )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isOfferDialogOpen && (
        <ReferralOfferDialog
            isOpen={isOfferDialogOpen}
            onClose={() => { setIsOfferDialogOpen(false); setEditingOffer(null); }}
            offer={editingOffer}
            onSubmit={handleOfferSubmit}
            isLoading={isSubmittingOffer}
        />
      )}
    </div>
  );
}


interface ReferralOfferDialogProps {
    isOpen: boolean;
    onClose: () => void;
    offer: ReferralOffer | null;
    onSubmit: (formData: Omit<ReferralOffer, 'id' | 'createdAt'>) => Promise<void>;
    isLoading: boolean;
}

function ReferralOfferDialog({ isOpen, onClose, offer, onSubmit, isLoading }: ReferralOfferDialogProps) {
    const [name, setName] = useState(offer?.name || '');
    const [description, setDescription] = useState(offer?.description || '');
    const [benefitsForReferrer, setBenefitsForReferrer] = useState(offer?.benefitsForReferrer || '');
    const [benefitsForReferred, setBenefitsForReferred] = useState(offer?.benefitsForReferred || '');
    const [expiryDate, setExpiryDate] = useState<Date | undefined>(offer?.expiryDate ? parseISO(offer.expiryDate) : undefined);
    const [isActive, setIsActive] = useState(offer?.isActive ?? true);

    useEffect(() => {
        if (offer) {
            setName(offer.name);
            setDescription(offer.description);
            setBenefitsForReferrer(offer.benefitsForReferrer);
            setBenefitsForReferred(offer.benefitsForReferred);
            setExpiryDate(offer.expiryDate ? parseISO(offer.expiryDate) : undefined);
            setIsActive(offer.isActive);
        } else {
            setName(''); setDescription(''); setBenefitsForReferrer(''); setBenefitsForReferred('');
            setExpiryDate(undefined); setIsActive(true);
        }
    }, [offer, isOpen]);

    const handleSubmit = () => {
        if (!name.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Offer name is required."});
            return;
        }
        onSubmit({
            name, description, benefitsForReferrer, benefitsForReferred,
            expiryDate: expiryDate ? expiryDate.toISOString() : null,
            isActive
        });
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{offer ? "Edit Referral Offer" : "Create New Referral Offer"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="offer-name">Offer Name *</Label>
                        <Input id="offer-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="offer-desc">Description</Label>
                        <Textarea id="offer-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={2}/>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="offer-bene-referrer">Benefits for Referrer</Label>
                        <Input id="offer-bene-referrer" value={benefitsForReferrer} onChange={(e) => setBenefitsForReferrer(e.target.value)} disabled={isLoading} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="offer-bene-referred">Benefits for Referred User</Label>
                        <Input id="offer-bene-referred" value={benefitsForReferred} onChange={(e) => setBenefitsForReferred(e.target.value)} disabled={isLoading} />
                    </div>
                    <div className="space-y-1.5">
                         <Label htmlFor="offer-expiry">Expiry Date (Optional)</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiryDate && "text-muted-foreground")} disabled={isLoading}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {expiryDate ? format(expiryDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1 ))}/>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="offer-active" checked={isActive} onCheckedChange={(checked) => setIsActive(!!checked)} disabled={isLoading} />
                        <Label htmlFor="offer-active" className="text-sm font-medium leading-none">Active</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (offer ? "Save Changes" : "Create Offer")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
