
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form'; // Correct import
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { useToast } from '@/hooks/use-toast';
import { type UserProfile } from '@/types';
// Import Firebase Auth functions if available, handle potential null auth instance
import { auth, firebaseInitializationError } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

// Schema for resetting password (now only needs email)
// const resetPasswordSchema = z.object({
//   newPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
//   confirmPassword: z.string(),
// }).refine((data) => data.newPassword === data.confirmPassword, {
//   message: "Passwords don't match",
//   path: ["confirmPassword"],
// });
// type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordDialogProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  // No onUserUpdate needed as password change doesn't affect the displayed user list directly
}

export default function ResetPasswordDialog({ user, isOpen, onClose }: ResetPasswordDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // No form needed if using Firebase password reset email

  const handleSendResetEmail = async () => {
    if (firebaseInitializationError || !auth) {
         toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: "Password reset unavailable: Firebase Auth not configured.",
         });
         return;
    }
     if (!user.email) {
          toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: "User email is missing, cannot send reset link.",
         });
         return;
     }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: 'Password Reset Email Sent',
        description: `An email has been sent to ${user.email} with instructions to reset their password.`,
        duration: 7000,
      });
      onClose(); // Close dialog after sending

    } catch (error: any) {
      console.error('Failed to send password reset email:', error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message || 'Could not send password reset email.',
      });
    } finally {
      setIsLoading(false);
    }
  };

   // Determine if Firebase Auth is properly initialized
   const isFirebaseAuthAvailable = !firebaseInitializationError && auth;


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password for {user.email}</DialogTitle>
           {isFirebaseAuthAvailable ? (
               <DialogDescription>
                    Click the button below to send a password reset link to the user's email address.
               </DialogDescription>
           ) : (
                <DialogDescription className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Password reset requires Firebase Authentication, which is not configured. This feature is disabled.
                </DialogDescription>
           )}
        </DialogHeader>

        {/* Remove the form */}
         {/* <Form {...form}> ... </Form> */}

        <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
             <Button
                type="button"
                onClick={handleSendResetEmail}
                disabled={isLoading || !isFirebaseAuthAvailable || !user.email}
             >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Email
            </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

