// src/components/admin/user-list-item.tsx
'use client';

import type { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, KeyRound, ShieldCheck, Trash2, Loader2, Phone, CalendarDays, ShoppingBag, Target, User as UserIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";

type DisplayUserProfile = Omit<UserProfile, 'password'>;

interface UserListItemProps {
  user: DisplayUserProfile;
  isDeleting: string | null;
  isChangingRole: string | null;
  adminUserEmail: string | null;
  onEdit: (user: DisplayUserProfile) => void;
  onResetPassword: (user: DisplayUserProfile) => void;
  onChangeRole: (user: DisplayUserProfile) => void;
  onDelete: (userId: string) => void;
  getInitials: (name?: string | null, email?: string | null) => React.ReactNode;
  formatDate: (dateString: string | Date | null | undefined) => string;
}

export default function UserListItem({
  user: u,
  isDeleting,
  isChangingRole,
  adminUserEmail,
  onEdit,
  onResetPassword,
  onChangeRole,
  onDelete,
  getInitials,
  formatDate
}: UserListItemProps) {
  const isCurrentUserPrimaryAdmin = u.email?.toLowerCase() === adminUserEmail?.toLowerCase();
  const avatarSrc = u.avatarUrl ? `/avatars/${u.avatarUrl}` : (u.email ? `https://avatar.vercel.sh/${u.email}.png?size=40` : undefined);

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarSrc} alt={u.name || 'User'} />
            <AvatarFallback>{getInitials(u.name, u.email)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{u.name || 'N/A'} {isCurrentUserPrimaryAdmin ? <Badge variant="outline" className="ml-1 text-xs border-destructive text-destructive">Primary</Badge> : ''}</p>
            <p className="text-xs text-muted-foreground">{u.email || 'N/A'}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">User Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(u)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetPassword(u)} disabled={isCurrentUserPrimaryAdmin}><KeyRound className="mr-2 h-4 w-4" /> Reset Password</DropdownMenuItem>
            {!isCurrentUserPrimaryAdmin && (
              <DropdownMenuItem onClick={() => onChangeRole(u)} disabled={isChangingRole === u.id}>
                {isChangingRole === u.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Change Role
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50" disabled={isCurrentUserPrimaryAdmin || !!isDeleting}>
                  {isDeleting === u.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{u.email}</span> and remove their data.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(u.id)} className="bg-destructive hover:bg-destructive/90">Yes, delete user</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3"/> Phone: <span className="text-foreground">{u.phone || 'N/A'}</span></div>
        <div className="flex items-center gap-1 text-muted-foreground"><UserIcon className="h-3 w-3"/> Role: <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-xs px-1.5 py-0.5">{u.role}</Badge></div>
        <div className="flex items-center gap-1 text-muted-foreground"><ShoppingBag className="h-3 w-3"/> Model: <span className="text-foreground capitalize">{u.model || 'N/A'}</span></div>
        <div className="flex items-center gap-1 text-muted-foreground"><UsersIcon className="h-3 w-3"/> Class: <span className="text-foreground">{u.class || 'N/A'}</span></div>
        <div className="flex items-center gap-1 text-muted-foreground"><Target className="h-3 w-3"/> Target Year: <span className="text-foreground">{u.targetYear || 'N/A'}</span></div>
        <div className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3"/> Expiry: <span className="text-foreground">{formatDate(u.expiry_date)}</span></div>
        <div className="col-span-2 flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3"/> Created: <span className="text-foreground">{formatDate(u.createdAt)}</span></div>
      </div>
    </div>
  );
}
