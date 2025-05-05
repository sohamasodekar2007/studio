'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    // Placeholder states for settings - load these from config/database/local storage
    const [newRegistrationsOpen, setNewRegistrationsOpen] = useState(true);
    const [defaultTestAccess, setDefaultTestAccess] = useState<'free' | 'paid'>('free'); // Example
    const [enableEmailNotifications, setEnableEmailNotifications] = useState(true); // Placeholder
    const [enableInAppNotifications, setEnableInAppNotifications] = useState(true); // Placeholder

    const handleSaveChanges = async () => {
        setIsLoading(true);
        // TODO: Implement logic to save settings to database/config file
        // For local JSON simulation, you might save these to a separate config.json
        console.log("Saving admin settings:", {
            newRegistrationsOpen,
            defaultTestAccess,
            enableEmailNotifications,
            enableInAppNotifications
        });
        // Example: Simulate saving to localStorage for demo purposes
        localStorage.setItem('adminSettings', JSON.stringify({
             newRegistrationsOpen, defaultTestAccess, enableEmailNotifications, enableInAppNotifications
         }));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        toast({
            title: "Settings Saved",
            description: "Admin settings have been updated.",
        });
        setIsLoading(false);
    };

     // TODO: Load settings on component mount from storage/API
     useState(() => {
        const savedSettings = localStorage.getItem('adminSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                setNewRegistrationsOpen(settings.newRegistrationsOpen ?? true);
                setDefaultTestAccess(settings.defaultTestAccess ?? 'free');
                setEnableEmailNotifications(settings.enableEmailNotifications ?? true);
                setEnableInAppNotifications(settings.enableInAppNotifications ?? true);
            } catch (e) {
                console.error("Failed to parse saved admin settings", e);
            }
        }
     });

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
            <p className="text-muted-foreground">Configure platform-wide settings and system configurations.</p>

            {/* General Settings */}
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
                                Temporarily disable access for non-admins. (Coming Soon)
                            </span>
                        </Label>
                        <Switch
                            id="maintenance-switch"
                            disabled // Enable when implemented
                        />
                    </div>
                     {/* Add more general settings here */}
                </CardContent>
            </Card>

            {/* Test Settings */}
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
                         {/* TODO: Replace with RadioGroup or Select when implementing test creation */}
                        <Input id="default-access" value={defaultTestAccess} disabled className="max-w-xs" />
                         <Button variant="outline" size="sm" disabled>Change</Button>
                    </div>
                    {/* Add more test-related settings like default duration, question pool rules etc. */}
                </CardContent>
            </Card>

            {/* System Configuration */}
            <Card>
                 <CardHeader>
                    <CardTitle>System Configuration</CardTitle>
                    <CardDescription>Manage notification settings and integrations.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                     {/* Notification Settings */}
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

                     {/* Integration Settings */}
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
                    <Button onClick={handleSaveChanges} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save All Settings
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
