'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getPlatformSettings, updatePlatformSettings } from '@/actions/settings-actions'; // Import new actions
import type { PlatformSettings } from '@/types';

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true); // For loading initial settings
    const [newRegistrationsOpen, setNewRegistrationsOpen] = useState(true);
    const [defaultTestAccess, setDefaultTestAccess] = useState<'free' | 'paid'>('free');
    const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
    const [enableInAppNotifications, setEnableInAppNotifications] = useState(true);
    const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false); // New state for maintenance mode

    // Load settings on component mount
    useEffect(() => {
        setIsLoadingSettings(true);
        getPlatformSettings()
            .then(settings => {
                if (settings) {
                    setNewRegistrationsOpen(settings.newRegistrationsOpen ?? true);
                    setDefaultTestAccess(settings.defaultTestAccess ?? 'free');
                    setEnableEmailNotifications(settings.enableEmailNotifications ?? true);
                    setEnableInAppNotifications(settings.enableInAppNotifications ?? true);
                    setMaintenanceModeEnabled(settings.maintenanceModeEnabled ?? false);
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
        const settingsToSave: PlatformSettings = {
            newRegistrationsOpen,
            defaultTestAccess,
            enableEmailNotifications,
            enableInAppNotifications,
            maintenanceModeEnabled,
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
                                Temporarily restrict access for non-admin users.
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
                        <Label htmlFor="default-access">Default Test Pricing (Example)</Label>
                         <p className="text-sm text-muted-foreground pb-2">
                           Set the default pricing model for newly created tests (can be overridden per test).
                         </p>
                        <Input id="default-access" value={defaultTestAccess} disabled className="max-w-xs" />
                         <Button variant="outline" size="sm" disabled>Change</Button>
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
                                Show notifications within the platform. (Coming Soon)
                            </span>
                        </Label>
                        <Switch
                            id="in-app-notifications"
                            checked={enableInAppNotifications}
                            onCheckedChange={setEnableInAppNotifications}
                             disabled // Enable when implemented
                        />
                    </div>

                     <h3 className="text-lg font-medium border-b pb-2 pt-4">Integrations</h3>
                     <div className="space-y-2 p-4 border rounded-lg">
                        <Label htmlFor="google-ai-key">Google AI API Key</Label>
                        <Input id="google-ai-key" type="password" value="**********" disabled />
                         <p className="text-xs text-muted-foreground">Managed via environment variables (.env).</p>
                    </div>
                     <div className="space-y-2 p-4 border rounded-lg">
                        <Label>Payment Gateway (Placeholder)</Label>
                         <p className="text-sm text-muted-foreground pb-2">
                           Configure Stripe/Razorpay keys for paid tests. (Coming Soon)
                         </p>
                         <Input id="payment-key" type="password" value="**********" disabled />
                          <p className="text-xs text-muted-foreground">Managed via environment variables or secure config.</p>
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
