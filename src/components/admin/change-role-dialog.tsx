// src/components/admin/change-role-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, User } from "lucide-react";
import type { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

type UserRole = 'Admin' | 'User';
const roles: UserRole[] = ['User', 'Admin'];

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;


interface ChangeRoleDialogProps {
  user: Omit<UserProfile, 'password'>; 
  isOpen: boolean;
  onClose: () => void;
  onRoleChange: (userId: string, newRole: UserRole) => Promise<void>;
  isLoading: boolean;
}

export default function ChangeRoleDialog({ user, isOpen, onClose, onRoleChange, isLoading }: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role || 'User');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(user.role || 'User');
    }
  }, [isOpen, user.role]);

  const handleSubmit = async () => {
     const emailLower = user.email?.toLowerCase() || '';
     if (selectedRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
         toast({ variant: "destructive", title: "Role Change Failed", description: `Cannot promote to Admin. Email '${user.email}' does not follow admin pattern ('username-admin@edunexus.com' or be the primary admin).` });
         return;
     }
     if (selectedRole === 'User' && emailLower === primaryAdminEmail.toLowerCase()) {
         toast({ variant: "destructive", title: "Role Change Failed", description: `Cannot demote the primary admin account to User.`});
         return;
     }
     
    await onRoleChange(user.id, selectedRole);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Role for {user.email}</DialogTitle>
          <DialogDescription>
            Select the new role for this user. This will affect their access and plan.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Add ScrollArea here */}
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="role-select">New Role</Label>
              <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)} disabled={isLoading}>
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'Admin' ? <ShieldCheck className="mr-2 h-4 w-4 inline-block" /> : <User className="mr-2 h-4 w-4 inline-block" />}
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRole === 'Admin' && (
              <p className="text-xs text-muted-foreground">
                Promoting to Admin will grant full access and set plan to 'Combo'. This user's email must match an admin pattern or be the primary admin email.
              </p>
            )}
            {selectedRole === 'User' && user.role === 'Admin' && (
              <p className="text-xs text-muted-foreground">
                Demoting from Admin will revert their plan to 'Free' (or their previous plan if known) and remove admin privileges.
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || selectedRole === user.role}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
