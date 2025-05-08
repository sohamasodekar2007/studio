// src/app/notebooks/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Notebook, PlusCircle, Trash2, Loader2, Search, Edit, RefreshCw, Tag } from 'lucide-react';
import type { UserNotebookData, Notebook, BookmarkedQuestion } from '@/types';
import { getUserNotebooks, createNotebook, deleteNotebook, removeQuestionFromNotebook } from '@/actions/notebook-actions'; // Import actions
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
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
import { useToast } from '@/hooks/use-toast';
import QuestionPreviewCard from '@/components/notebooks/question-preview-card'; // Import the preview card

export default function NotebooksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [notebookData, setNotebookData] = useState<UserNotebookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null); // Track selected notebook
  const [searchTerm, setSearchTerm] = useState(''); // For searching questions

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
      // If a notebook was previously selected or if there's only one, select it
      if (!selectedNotebookId && data.notebooks.length > 0) {
          setSelectedNotebookId(data.notebooks[0].id);
      } else if (selectedNotebookId && !data.notebooks.some(n => n.id === selectedNotebookId)) {
          // If the selected notebook was deleted, select the first one if available
           setSelectedNotebookId(data.notebooks.length > 0 ? data.notebooks[0].id : null);
      }

    } catch (err: any) {
      console.error("Error fetching notebook data:", err);
      setError(err.message || "Failed to load your notebooks.");
      setNotebookData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedNotebookId]); // Ensure userId is included if used

  useEffect(() => {
    if (!authLoading) { // Wait for auth state to settle
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
        setSelectedNotebookId(result.notebook.id); // Select the newly created notebook
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
       // Consider adding a loading state for deletion if needed
       try {
           const result = await deleteNotebook(user.id, notebookId);
           if (result.success) {
               toast({ title: "Notebook Deleted" });
               fetchNotebookData(); // Refresh data
               // If the deleted notebook was selected, reset selection
                if (selectedNotebookId === notebookId) {
                    // Find the index of the deleted notebook
                    const deletedIndex = notebookData?.notebooks.findIndex(n => n.id === notebookId) ?? -1;
                    // Select the previous notebook if possible, otherwise the next, or null if list becomes empty
                     const nextSelectionIndex = deletedIndex > 0 ? deletedIndex - 1 : (notebookData?.notebooks.length ?? 0 > 1 ? 0 : -1);
                     setSelectedNotebookId(nextSelectionIndex !== -1 ? notebookData?.notebooks[nextSelectionIndex].id ?? null : null);
                }
           } else {
               throw new Error(result.message || "Failed to delete notebook.");
           }
       } catch (error: any) {
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
       }
   };

   const handleRemoveQuestion = async (notebookId: string, questionId: string) => {
        if (!user?.id) return;
        try {
            const result = await removeQuestionFromNotebook(user.id, notebookId, questionId);
            if (result.success) {
                 toast({ title: "Question Removed", description: "Question removed from this notebook." });
                 // Optimistically update UI or refetch
                 setNotebookData(prev => {
                     if (!prev) return null;
                     const updatedBookmarks = { ...prev.bookmarkedQuestions };
                     if (updatedBookmarks[notebookId]) {
                         updatedBookmarks[notebookId] = updatedBookmarks[notebookId].filter(q => q.questionId !== questionId);
                     }
                     return { ...prev, bookmarkedQuestions: updatedBookmarks };
                 });
                 // Alternatively: await fetchNotebookData();
            } else {
                 throw new Error(result.message || "Failed to remove question.");
            }
        } catch (error: any) {
             toast({ variant: "destructive", title: "Removal Failed", description: error.message });
        }
   };


   const selectedNotebook = notebookData?.notebooks.find(n => n.id === selectedNotebookId);
   const questionsInSelectedNotebook = selectedNotebookId ? (notebookData?.bookmarkedQuestions[selectedNotebookId] || []) : [];

   // Filter questions based on search term (searches questionId, maybe tags later)
   const filteredQuestions = questionsInSelectedNotebook.filter(q =>
        q.questionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.lesson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
   );

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-1" />
          <Skeleton className="h-96 md:col-span-2" />
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
         <Button onClick={fetchNotebookData}><RefreshCw className="mr-2 h-4 w-4" /> Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Notebooks</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar - Notebook List */}
        <Card className="lg:col-span-1 sticky top-4">
          <CardHeader>
            <CardTitle>Notebooks</CardTitle>
            <CardDescription>Organize your saved questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(!showCreateForm)} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Notebook
            </Button>
            {showCreateForm && (
              <div className="flex items-center space-x-2 p-2 border rounded-md">
                <Input
                  placeholder="New notebook name..."
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  disabled={isCreating}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleCreateNotebook} disabled={isCreating || !newNotebookName.trim()}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
                 <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} disabled={isCreating}>
                    Cancel
                </Button>
              </div>
            )}
             <ScrollArea className="h-[calc(100vh-300px)] mt-4"> {/* Adjust height as needed */}
                 <div className="space-y-1 pr-2">
                 {(notebookData?.notebooks || []).length > 0 ? (
                    notebookData?.notebooks.map((notebook) => (
                        <div key={notebook.id} className="flex items-center justify-between w-full rounded-md hover:bg-muted/50">
                            <Button // Button for selecting the notebook
                                variant="ghost"
                                className={`flex-grow justify-start text-sm h-9 px-2 ${selectedNotebookId === notebook.id ? 'bg-secondary hover:bg-secondary text-secondary-foreground' : ''}`}
                                onClick={() => setSelectedNotebookId(notebook.id)}
                             >
                                <Notebook className="mr-2 h-4 w-4 flex-shrink-0" />
                                <span className="truncate flex-grow text-left">{notebook.name}</span>
                            </Button>
                            {/* Delete action next to the select button */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 ml-1 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                        // onClick={(e) => e.stopPropagation()} // Keep stopPropagation if needed, though maybe not necessary anymore
                                    >
                                        <Trash2 className="h-3.5 w-3.5"/>
                                    </Button>
                                </AlertDialogTrigger>
                                 <AlertDialogContent>
                                     <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Notebook?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                             Are you sure you want to delete the notebook "{notebook.name}"? All bookmarked questions within it will be removed from this notebook (but not deleted from the question bank). This action cannot be undone.
                                        </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                                         <AlertDialogAction onClick={() => handleDeleteNotebook(notebook.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                     </AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
                        </div>
                     ))
                 ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">No notebooks yet. Create one!</p>
                 )}
                 </div>
             </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content - Selected Notebook's Questions */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                     <CardTitle>{selectedNotebook ? selectedNotebook.name : "Select a Notebook"}</CardTitle>
                     <CardDescription>
                         {selectedNotebook ? `Questions saved in this notebook (${questionsInSelectedNotebook.length} total)` : "Choose a notebook from the left to view its questions."}
                     </CardDescription>
                </div>
                 <div className="relative w-full max-w-xs">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                        placeholder="Search in this notebook..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-9"
                        disabled={!selectedNotebook}
                     />
                 </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                 <div className="space-y-4">
                     <Skeleton className="h-20 w-full" />
                     <Skeleton className="h-20 w-full" />
                     <Skeleton className="h-20 w-full" />
                 </div>
              ) : !selectedNotebook ? (
                <div className="text-center py-10 text-muted-foreground">
                     <Notebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                     Select or create a notebook to get started.
                 </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                     {searchTerm ? `No questions found matching "${searchTerm}" in this notebook.` : "This notebook is empty. Add questions from the DPP section!"}
                 </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question) => (
                    <QuestionPreviewCard
                        key={question.questionId}
                        bookmarkedQuestion={question}
                        onRemove={() => selectedNotebookId && handleRemoveQuestion(selectedNotebookId, question.questionId)}
                     />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
