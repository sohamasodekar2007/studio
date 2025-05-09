
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, KeyRound, Power, AlertTriangle } from "lucide-react"; // Added icons
import { getPlatformSettings, updatePlatformSettings } from '@/actions/settings-actions';
import type { PlatformSettings, PricingType } from '@/types'; 
import { pricingTypes } from '@/types'; 
import { Skeleton } from "@/components/ui/skeleton"; 
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"; 

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    
    // General Settings
    const [newRegistrationsOpen, setNewRegistrationsOpen] = useState(true);
    const [defaultTestAccess, setDefaultTestAccess] = useState<PricingType>('FREE'); 
    const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
    const [enableInAppNotifications, setEnableInAppNotifications] = useState(true);
    const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false);

    // Payment Gateway Settings
    const [paymentGatewayEnabled, setPaymentGatewayEnabled] = useState(false);
    const [stripeApiKey, setStripeApiKey] = useState('');
    const [razorpayApiKey, setRazorpayApiKey] = useState('');
    const [instamojoApiKey, setInstamojoApiKey] = useState('');


    useEffect(() => {
        setIsLoadingSettings(true);
        getPlatformSettings()
            .then(settings => {
                if (settings) {
                    setNewRegistrationsOpen(settings.newRegistrationsOpen ?? true);
                    setDefaultTestAccess(settings.defaultTestAccess ?? 'FREE'); 
                    setEnableEmailNotifications(settings.enableEmailNotifications ?? true);
                    setEnableInAppNotifications(settings.enableInAppNotifications ?? true);
                    setMaintenanceModeEnabled(settings.maintenanceModeEnabled ?? false);
                    // Load payment gateway settings
                    setPaymentGatewayEnabled(settings.paymentGatewayEnabled ?? false);
                    setStripeApiKey(settings.stripeApiKey || ''); // Use empty string if null
                    setRazorpayApiKey(settings.razorpayApiKey || '');
                    setInstamojoApiKey(settings.instamojoApiKey || '');
                }
            })
            .catch(e => {
                console.error("Failed to load platform settings", e);
                toast({ variant: "destructive", title: "Error", description: "Could not load platform settings." });
            })
            .finally(() => {
                setIsLoadingSettings(false);
            });
    }, [toast]);

    const handleSaveChanges = async () => {
        setIsLoading(true);
        const settingsToSave: Partial<PlatformSettings> = {
            newRegistrationsOpen,
            defaultTestAccess,
            enableEmailNotifications,
            enableInAppNotifications,
            maintenanceModeEnabled,
            paymentGatewayEnabled,
            stripeApiKey: stripeApiKey.trim() || null, // Store as null if empty
            razorpayApiKey: razorpayApiKey.trim() || null,
            instamojoApiKey: instamojoApiKey.trim() || null,
        };

        try {
            const success = await updatePlatformSettings(settingsToSave);
            if (success) {
                toast({
                    title: "Settings Saved",
                    description: "Platform settings have been updated.",
                });
            } else {
                throw new Error("Failed to save settings to the server.");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: error.message || "Could not save platform settings.",
            });
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoadingSettings) {
        return (
            <div className="space-y-6 max-w-3xl mx-auto">
                 <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
                 <Skeleton className="h-48 w-full" />
                 <Skeleton className="h-32 w-full" />
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-80 w-full" /> {/* Added skeleton for integrations */}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
            <p className="text-muted-foreground">Configure platform-wide settings and system configurations.</p>

            <Card>
                <CardHeader>
                    <CardTitle>General Platform Settings</CardTitle>
                    <CardDescription>Manage basic platform configurations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <Label htmlFor="registration-switch" className="flex flex-col space-y-1">
                            <span>Allow New User Registrations</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Enable or disable new users from signing up.
                            </span>
                        </Label>
                        <Switch
                            id="registration-switch"
                            checked={newRegistrationsOpen}
                            onCheckedChange={setNewRegistrationsOpen}
                            disabled={isLoading}
                        />
                    </div>
                     <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <Label htmlFor="maintenance-switch" className="flex flex-col space-y-1">
                            <span>Maintenance Mode</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Temporarily restrict access for non-admin users. Admins can still access the site.
                            </span>
                        </Label>
                        <Switch
                            id="maintenance-switch"
                            checked={maintenanceModeEnabled}
                            onCheckedChange={setMaintenanceModeEnabled}
                            disabled={isLoading}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Test Settings</CardTitle>
                    <CardDescription>Configure default settings for tests.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 p-4 border rounded-lg">
                        <Label htmlFor="default-access">Default Test Access Type</Label>
                         <p className="text-sm text-muted-foreground pb-2">
                           Set the default access type for newly created tests (can be overridden per test).
                         </p>
                        <Select 
                            value={defaultTestAccess} 
                            onValueChange={(value: PricingType) => setDefaultTestAccess(value)}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Select Access Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {pricingTypes.map(type => (
                                    <SelectItem key={type} value={type} className="capitalize">
                                        {type.replace('_', ' ').toLowerCase()}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                 <CardHeader>
                    <CardTitle>System Configuration</CardTitle>
                    <CardDescription>Manage notification settings and integrations.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                     <h3 className="text-lg font-medium border-b pb-2">Notifications</h3>
                     <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                            <span>Email Notifications</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Send emails for results, updates, etc. (Requires setup)
                            </span>
                        </Label>
                        <Switch
                            id="email-notifications"
                            checked={enableEmailNotifications}
                            onCheckedChange={setEnableEmailNotifications}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <Label htmlFor="in-app-notifications" className="flex flex-col space-y-1">
                            <span>In-App Notifications</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Show notifications within the EduNexus platform.
                            </span>
                        </Label>
                        <Switch
                            id="in-app-notifications"
                            checked={enableInAppNotifications}
                            onCheckedChange={setEnableInAppNotifications}
                             disabled={isLoading} 
                        />
                    </div>

                     <h3 className="text-lg font-medium border-b pb-2 pt-4">Payment Gateway</h3>
                      <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <Label htmlFor="payment-gateway-switch" className="flex flex-col space-y-1">
                            <span>Enable Payment Gateway</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Allow users to purchase premium tests.
                            </span>
                        </Label>
                        <Switch
                            id="payment-gateway-switch"
                            checked={paymentGatewayEnabled}
                            onCheckedChange={setPaymentGatewayEnabled}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600"/> API Keys are sensitive. Store them securely. These are for local demonstration and will be stored in a JSON file.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="stripe-api-key" className="flex items-center gap-1"><KeyRound className="h-4 w-4"/>Stripe API Key</Label>
                            <Input id="stripe-api-key" type="password" value={stripeApiKey} onChange={(e) => setStripeApiKey(e.target.value)} placeholder="sk_test_••••••••••••••••" disabled={isLoading || !paymentGatewayEnabled}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="razorpay-api-key" className="flex items-center gap-1"><KeyRound className="h-4 w-4"/>Razorpay API Key</Label>
                            <Input id="razorpay-api-key" type="password" value={razorpayApiKey} onChange={(e) => setRazorpayApiKey(e.target.value)} placeholder="rzp_test_••••••••••••" disabled={isLoading || !paymentGatewayEnabled}/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="instamojo-api-key" className="flex items-center gap-1"><KeyRound className="h-4 w-4"/>Instamojo API Key</Label>
                            <Input id="instamojo-api-key" type="password" value={instamojoApiKey} onChange={(e) => setInstamojoApiKey(e.target.value)} placeholder="test_•••••••••••••••" disabled={isLoading || !paymentGatewayEnabled}/>
                        </div>
                    </div>


                     <h3 className="text-lg font-medium border-b pb-2 pt-4">Other Integrations</h3>
                     <div className="space-y-2 p-4 border rounded-lg">
                        <Label htmlFor="google-ai-key">Google AI API Key</Label>
                        <Input id="google-ai-key" type="password" value={process.env.GOOGLE_GENAI_API_KEY ? '••••••••••••••••••' : 'Not Set'} disabled />
                         <p className="text-xs text-muted-foreground">Managed via GOOGLE_GENAI_API_KEY environment variable (.env).</p>
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleSaveChanges} disabled={isLoading || isLoadingSettings}>
                        {(isLoading || isLoadingSettings) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save All Settings
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}