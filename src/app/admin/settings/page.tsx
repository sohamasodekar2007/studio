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
    // Placeholder states for settings - load these from config/database
    const [newRegistrationsOpen, setNewRegistrationsOpen] = useState(true);
    const [defaultTestAccess, setDefaultTestAccess] = useState<'free' | 'paid'>('free'); // Example

    const handleSaveChanges = async () => {
        setIsLoading(true);
        // TODO: Implement logic to save settings to database/config
        console.log("Saving admin settings:", { newRegistrationsOpen, defaultTestAccess });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        toast({
            title: "Settings Saved",
            description: "Admin settings have been updated.",
        });
        setIsLoading(false);
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
            <p className="text-muted-foreground">Configure platform-wide settings.</p>

            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
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
                            <span>Maintenance Mode (Coming Soon)</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Temporarily disable access for users for maintenance.
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

            <Card>
                <CardHeader>
                    <CardTitle>Test Settings</CardTitle>
                    <CardDescription>Configure default settings for tests.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 p-4 border rounded-lg">
                        <Label htmlFor="default-access">Default Test Access (Example)</Label>
                         <p className="text-sm text-muted-foreground pb-2">
                           Set the default pricing model for newly created tests (can be overridden).
                         </p>
                         {/* Replace with RadioGroup or Select when options grow */}
                        <Input id="default-access" value={defaultTestAccess} disabled className="max-w-xs" />
                         <Button variant="outline" size="sm" disabled>Change</Button>
                    </div>
                    {/* Add more test-related settings */}
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleSaveChanges} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save All Settings
                    </Button>
                </CardFooter>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Integration Settings (Placeholder)</CardTitle>
                    <CardDescription>Manage API keys and third-party integrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="google-ai-key">Google AI API Key</Label>
                        <Input id="google-ai-key" type="password" value="**************" disabled />
                         <p className="text-xs text-muted-foreground">Managed via environment variables (.env).</p>
                    </div>
                     {/* Add Payment Gateway Keys, Email Service Keys etc. */}
                </CardContent>
            </Card>

        </div>
    );
}
