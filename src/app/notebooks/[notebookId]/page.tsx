// src/app/notebooks/[notebookId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Notebook, ArrowLeft, Loader2, Search, Tag, Trash2 } from 'lucide-react';
import type { UserNotebookData, BookmarkedQuestion, Notebook } from '@/types';
import { getUserNotebooks, removeQuestionFromNotebook } from '@/actions/notebook-actions';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import QuestionPreviewCard from '@/components/notebooks/question-preview-card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function NotebookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const notebookId = params.notebookId as string;

  const [notebookData, setNotebookData] = useState<UserNotebookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRemovingQuestionId, setIsRemovingQuestionId] = useState<string | null>(null);


  const fetchNotebookData = useCallback(async () => {
    if (!user?.id || !notebookId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserNotebooks(user.id);
      setNotebookData(data);
      if (!data.notebooks.some(n => n.id === notebookId)) {
         setError("Notebook not found.");
      }
    } catch (err: any) {
      console.error("Error fetching notebook data:", err);
      setError(err.message || "Failed to load notebook data.");
      setNotebookData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, notebookId]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/login?redirect=/notebooks/${notebookId}`);
      } else {
        fetchNotebookData();
      }
    }
  }, [user, authLoading, router, notebookId, fetchNotebookData]);

  const handleRemoveQuestion = async (questionId: string) => {
    if (!user?.id || !notebookId) return;
    setIsRemovingQuestionId(questionId);
    try {
        const result = await removeQuestionFromNotebook(user.id, notebookId, questionId);
        if (result.success) {
             toast({ title: "Question Removed", description: "Question removed from this notebook." });
             // Optimistically update UI
             setNotebookData(prev => {
                 if (!prev) return null;
                 const updatedBookmarks = { ...prev.bookmarkedQuestions };
                 if (updatedBookmarks[notebookId]) {
                     updatedBookmarks[notebookId] = updatedBookmarks[notebookId].filter(q => q.questionId !== questionId);
                 }
                 return { ...prev, bookmarkedQuestions: updatedBookmarks };
             });
        } else {
             throw new Error(result.message || "Failed to remove question.");
        }
    } catch (error: any) {
         toast({ variant: "destructive", title: "Removal Failed", description: error.message });
    } finally {
        setIsRemovingQuestionId(null);
    }
  };

  const notebook = notebookData?.notebooks.find(n => n.id === notebookId);
  const allQuestionsInNotebook = notebookId ? (notebookData?.bookmarkedQuestions[notebookId] || []) : [];

  const filteredQuestions = useMemo(() => {
    return allQuestionsInNotebook.filter(q =>
        q.questionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.lesson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [allQuestionsInNotebook, searchTerm]);

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
          <Link href="/notebooks">Back to Notebooks</Link>
        </Button>
      </div>
    );
  }

  if (!notebook) {
    // This case is handled by the error state from fetchNotebookData, but added for robustness
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Notebook Not Found</h1>
        <Button asChild variant="outline">
          <Link href="/notebooks">Back to Notebooks</Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <Button variant="outline" size="sm" asChild>
                <Link href="/notebooks">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notebooks
                </Link>
            </Button>
             <div className="relative w-full sm:w-auto sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                placeholder="Search in this notebook..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
                />
            </div>
        </div>

        <Card>
            <CardHeader>
            <CardTitle className="text-2xl">{notebook.name}</CardTitle>
            <CardDescription>
                {allQuestionsInNotebook.length} questions saved. Created on {new Date(notebook.createdAt).toLocaleDateString()}.
            </CardDescription>
            </CardHeader>
            <CardContent>
            {filteredQuestions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    {searchTerm ? `No questions found matching "${searchTerm}".` : "This notebook is empty. Add questions from the DPP section!"}
                </div>
            ) : (
                 <ScrollArea className="h-[calc(100vh-300px)]"> {/* Adjust height */}
                     <div className="space-y-4 pr-4">
                        {filteredQuestions.map((question) => (
                            <QuestionPreviewCard
                            key={question.questionId}
                            bookmarkedQuestion={question}
                            onRemove={() => handleRemoveQuestion(question.questionId)}
                            isRemoving={isRemovingQuestionId === question.questionId} // Pass loading state
                            />
                        ))}
                     </div>
                 </ScrollArea>
            )}
            </CardContent>
        </Card>
    </div>
  );
}
