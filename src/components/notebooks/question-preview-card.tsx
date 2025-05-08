// src/components/notebooks/question-preview-card.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Tag, ExternalLink, AlertTriangle, FileText, ImageIcon, Eye, Loader2 } from 'lucide-react'; // Added Loader2
import type { BookmarkedQuestion, QuestionBankItem } from '@/types';
import { getQuestionById } from '@/actions/notebook-actions'; // Action to fetch full question data
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
import ImageViewDialog from './image-view-dialog'; // Import the new dialog

interface QuestionPreviewCardProps {
  bookmarkedQuestion: BookmarkedQuestion;
  onRemove: () => void;
  isRemoving?: boolean; // Optional prop to indicate removal in progress
}

// Helper function to construct image paths relative to the public directory
const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images'; // Base path within public
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};


export default function QuestionPreviewCard({ bookmarkedQuestion, onRemove, isRemoving = false }: QuestionPreviewCardProps) {
  const [questionData, setQuestionData] = useState<QuestionBankItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageViewOpen, setIsImageViewOpen] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);


  useEffect(() => {
    const fetchQuestion = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getQuestionById(bookmarkedQuestion.questionId, bookmarkedQuestion.subject, bookmarkedQuestion.lesson);
        if (data) {
          setQuestionData(data);
        } else {
          setError("Question data not found.");
        }
      } catch (err) {
        setError("Failed to load question data.");
        console.error("Error fetching question data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [bookmarkedQuestion]);

  const handleViewImage = (path: string | null) => {
      if (path) {
          setImageToView(path);
          setIsImageViewOpen(true);
      }
  }

  const renderPreviewContent = () => {
    if (isLoading) {
      return (
        <>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </>
      );
    }
    if (error) {
        return (
            <div className="flex items-center text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 mr-2"/> {error}
            </div>
        );
    }
    if (!questionData) {
        return <p className="text-sm text-muted-foreground">Question details unavailable.</p>;
    }

    const imagePath = constructImagePath(questionData.subject, questionData.lesson, questionData.question.image);

    if (questionData.type === 'image' && imagePath) {
        return (
             <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                {/* Display only ID for image questions */}
                <span className="text-sm truncate font-mono text-muted-foreground">({questionData.id})</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto" onClick={() => handleViewImage(imagePath)}>
                    <Eye className="h-3.5 w-3.5 mr-1"/> View Image
                </Button>
            </div>
        );
    } else if (questionData.type === 'text' && questionData.question.text) {
        // Basic preview, no MathJax rendering here for performance
        return (
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                 <p className="text-sm truncate">{questionData.question.text}</p>
            </div>
        );
    } else {
        return <p className="text-sm text-muted-foreground">Preview not available.</p>;
    }
  };

  const dppLink = `/dpp/${encodeURIComponent(bookmarkedQuestion.subject)}/${encodeURIComponent(bookmarkedQuestion.lesson)}?questionId=${bookmarkedQuestion.questionId}`;

  return (
    <>
    <Card className="bg-background hover:bg-muted/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-2">
             <div className="flex-grow min-w-0">
                {renderPreviewContent()}
                 <p className="text-xs text-muted-foreground mt-1">
                     Added: {new Date(bookmarkedQuestion.addedAt).toLocaleDateString()} | Subject: {bookmarkedQuestion.subject} | Lesson: {bookmarkedQuestion.lesson}
                 </p>
             </div>
             <AlertDialog>
                 <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive" disabled={isRemoving}>
                        {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                     </Button>
                 </AlertDialogTrigger>
                  <AlertDialogContent>
                     <AlertDialogHeader>
                         <AlertDialogTitle>Remove Bookmark?</AlertDialogTitle>
                         <AlertDialogDescription>
                             Are you sure you want to remove this question from this notebook?
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
            {bookmarkedQuestion.tags && bookmarkedQuestion.tags.length > 0 && (
                 bookmarkedQuestion.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs py-0.5 px-1.5">
                         <Tag className="h-3 w-3 mr-1"/> {tag}
                    </Badge>
                 ))
            )}
             <Link href={dppLink} passHref>
                <Button variant="link" size="sm" className="text-xs h-6 px-1 text-primary">
                     Go to Question <ExternalLink className="h-3 w-3 ml-1"/>
                </Button>
             </Link>
        </div>
      </CardContent>
    </Card>

    {/* Image View Dialog */}
    {imageToView && (
        <ImageViewDialog
            isOpen={isImageViewOpen}
            onClose={() => setIsImageViewOpen(false)}
            imageUrl={imageToView}
            altText={`Question Image: ${bookmarkedQuestion.questionId}`}
        />
    )}
    </>
  );
}
