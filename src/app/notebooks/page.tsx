// src/app/notebooks/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Notebook, PlusCircle, Trash2, Loader2, MoreVertical, Info } from 'lucide-react';
import type { UserNotebookData, Notebook as NotebookType } from '@/types'; // Renamed Notebook to NotebookType
import { getUserNotebooks, createNotebook, deleteNotebook } from '@/actions/notebook-actions';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { ScrollArea } from '@/components/ui/scroll-area';

export default function NotebooksListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [notebookData, setNotebookData] = useState<UserNotebookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [isCreating, setIsCreating] = useState(false); // Initialize to false
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchNotebookData = useCallback(async () => {
    if (!user?.id) {
        setIsLoading(false);
        return;
    };
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserNotebooks(user.id);
      setNotebookData(data);
    } catch (err: any) {
      console.error("Error fetching notebook data:", err);
      setError(err.message || "Failed to load your notebooks.");
      setNotebookData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
        if (!user) {
            router.push('/auth/login?redirect=/notebooks');
        } else {
            fetchNotebookData();
        }
    }
  }, [user, authLoading, router, fetchNotebookData]);

  const handleCreateNotebook = async () => {
    if (!user?.id || !newNotebookName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createNotebook(user.id, newNotebookName.trim());
      if (result.success && result.notebook) {
        toast({ title: "Notebook Created", description: `"${result.notebook.name}" added.` });
        setNewNotebookName('');
        setShowCreateForm(false);
        fetchNotebookData(); // Refresh data
      } else {
        throw new Error(result.message || "Failed to create notebook.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

   const handleDeleteNotebook = async (notebookId: string) => {
       if (!user?.id) return;
       setIsDeletingId(notebookId);
       try {
           const result = await deleteNotebook(user.id, notebookId);
           if (result.success) {
               toast({ title: "Notebook Deleted" });
               fetchNotebookData(); // Refresh data
           } else {
               throw new Error(result.message || "Failed to delete notebook.");
           }
       } catch (error: any) {
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
       } finally {
            setIsDeletingId(null);
       }
   };

  const getQuestionCount = (notebookId: string): number => {
      return notebookData?.bookmarkedQuestions?.[notebookId]?.length || 0;
  }

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Notebooks</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
         <Button onClick={fetchNotebookData}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Notebooks</h1>
                 <TooltipProvider>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                           <Info className="h-4 w-4" />
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>Save important questions from DPPs into different notebooks for organized revision.</p>
                     </TooltipContent>
                   </Tooltip>
                 </TooltipProvider>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New
            </Button>
        </div>

         {showCreateForm && (
            <Card className="mb-6">
                <CardContent className="p-4 flex items-center space-x-2">
                    <Input
                    placeholder="New notebook name..."
                    value={newNotebookName}
                    onChange={(e) => setNewNotebookName(e.target.value)}
                    disabled={isCreating}
                    className="flex-grow"
                    />
                    <Button size="sm" onClick={handleCreateNotebook} disabled={isCreating || !newNotebookName.trim()}>
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} disabled={isCreating}>
                        Cancel
                    </Button>
                </CardContent>
            </Card>
          )}

        {/* Notebook Grid */}
        <div className="space-y-4"> {/* Replaced grid with space-y */}
        {(notebookData?.notebooks || []).length > 0 ? (
            <ScrollArea className="h-[calc(100vh-300px)]"> {/* Adjust height as needed */}
                 <div className="space-y-1 pr-2">
                    {notebookData?.notebooks.map((notebook) => (
                        <Card key={notebook.id} className="hover:shadow-sm transition-shadow duration-150 group relative bg-card flex items-center">
                            <Link href={`/notebooks/${notebook.id}`} passHref className="flex-grow block">
                                <CardContent className="p-3 cursor-pointer">
                                    <CardTitle className="text-base mb-0.5 truncate group-hover:text-primary transition-colors">{notebook.name}</CardTitle>
                                    <CardDescription className="text-xs">{getQuestionCount(notebook.id)} Questions</CardDescription>
                                </CardContent>
                            </Link>
                            {/* Delete Dropdown */}
                            <div className="pr-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                                    disabled={isDeletingId === notebook.id}
                                                >
                                                    {isDeletingId === notebook.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Notebook?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete "{notebook.name}"? All associated bookmarks will be removed. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteNotebook(notebook.id)} className="bg-destructive hover:bg-destructive/90">
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </Card>
                    ))}
                 </div>
             </ScrollArea>
        ) : (
             <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    <Notebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    You haven't created any notebooks yet. Click "Create New" to get started.
                </CardContent>
             </Card>
        )}
        </div>
    </div>
  );
}
