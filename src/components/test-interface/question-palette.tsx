// src/components/test-interface/question-palette.tsx
'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { QuestionStatus, TestQuestion } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { cn } from '@/lib/utils';
import { CheckSquare, Flag, Send, Loader2 } from 'lucide-react';
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

const QUESTION_STATUS_COLORS: Record<QuestionStatus, string> = {
  [QuestionStatusEnum.NotVisited]: 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  [QuestionStatusEnum.Unanswered]: 'bg-red-400 hover:bg-red-500 text-white dark:bg-red-600 dark:hover:bg-red-500',
  [QuestionStatusEnum.Answered]: 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-500',
  [QuestionStatusEnum.MarkedForReview]: 'bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-500',
  [QuestionStatusEnum.AnsweredAndMarked]: 'bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-500',
};

interface QuestionPaletteProps {
  questions: TestQuestion[];
  questionStatuses: Record<string, QuestionStatus>; // questionId -> status
  currentGlobalIndex: number;
  onQuestionSelect: (globalIndex: number) => void;
  onSubmitTest: () => void;
  isSubmitting: boolean;
  questionsBySection: Record<string, TestQuestion[]>;
  currentSection: string;
}

export default function QuestionPalette({
  questions,
  questionStatuses,
  currentGlobalIndex,
  onQuestionSelect,
  onSubmitTest,
  isSubmitting,
  questionsBySection,
  currentSection
}: QuestionPaletteProps) {

  const getGlobalIndex = (sectionName: string, indexInSection: number): number => {
    let globalIdx = 0;
    for (const secName in questionsBySection) {
        if (secName === sectionName) {
            globalIdx += indexInSection;
            return globalIdx;
        }
        globalIdx += questionsBySection[secName].length;
    }
    return -1; // Should not happen
  };


  return (
    <aside className="w-60 md:w-72 border-l bg-card p-3 md:p-4 flex flex-col">
      <h3 className="font-semibold mb-2 text-center text-sm md:text-base">Question Palette</h3>
      <ScrollArea className="flex-grow mb-3">
        {Object.entries(questionsBySection).map(([sectionName, sectionQuestions]) => (
            <div key={sectionName} className="mb-3">
                 <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">{sectionName} ({sectionQuestions.length})</p>
                <div className="grid grid-cols-5 md:grid-cols-6 gap-1.5">
                {sectionQuestions.map((q, indexInSection) => {
                    const globalIdx = getGlobalIndex(sectionName, indexInSection);
                    const status = q.id ? questionStatuses[q.id] : QuestionStatusEnum.NotVisited;
                    return (
                    <Button
                        key={q.id || `q_palette_${globalIdx}`}
                        variant="outline"
                        size="icon"
                        className={cn(
                        "h-7 w-7 md:h-8 md:w-8 text-xs font-medium",
                        QUESTION_STATUS_COLORS[status],
                        currentGlobalIndex === globalIdx && "ring-2 ring-offset-1 ring-primary dark:ring-offset-card"
                        )}
                        onClick={() => onQuestionSelect(globalIdx)}
                        disabled={isSubmitting}
                    >
                        {indexInSection + 1}
                    </Button>
                    );
                })}
                </div>
            </div>
        ))}
      </ScrollArea>

      <div className="mt-auto space-y-2 text-xs">
        <div className="p-2 border rounded-md bg-muted/30">
            <p className="font-medium mb-1">Legend:</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <div className="flex items-center gap-1.5"><span className={cn("inline-block w-2.5 h-2.5 rounded-sm", QUESTION_STATUS_COLORS[QuestionStatusEnum.Answered])}></span> Answered</div>
                <div className="flex items-center gap-1.5"><span className={cn("inline-block w-2.5 h-2.5 rounded-sm", QUESTION_STATUS_COLORS[QuestionStatusEnum.Unanswered])}></span> Not Answered</div>
                <div className="flex items-center gap-1.5"><span className={cn("inline-block w-2.5 h-2.5 rounded-sm", QUESTION_STATUS_COLORS[QuestionStatusEnum.NotVisited])}></span> Not Visited</div>
                <div className="flex items-center gap-1.5"><span className={cn("inline-block w-2.5 h-2.5 rounded-sm", QUESTION_STATUS_COLORS[QuestionStatusEnum.MarkedForReview])}></span> Marked</div>
                <div className="flex items-center gap-1.5 col-span-2"><span className={cn("inline-block w-2.5 h-2.5 rounded-sm", QUESTION_STATUS_COLORS[QuestionStatusEnum.AnsweredAndMarked])}></span> Answered & Marked</div>
            </div>
        </div>
        
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                    Submit Test
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to submit the test? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onSubmitTest} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Yes, Submit
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
