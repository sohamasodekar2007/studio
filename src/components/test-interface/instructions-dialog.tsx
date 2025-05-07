
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { GeneratedTest } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";

interface InstructionsDialogProps {
  isOpen: boolean;
  testData: GeneratedTest | null;
  onProceed: () => void;
}

export default function InstructionsDialog({ isOpen, testData, onProceed }: InstructionsDialogProps) {
  if (!testData) return null;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl text-center">Test Instructions: {testData.name}</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground">
            Please read the following instructions carefully before starting the test.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="max-h-[60vh] p-1 pr-4">
            <div className="space-y-4 text-sm">
                <div className="p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-base mb-2 flex items-center"><Info className="h-5 w-5 mr-2 text-primary"/>General Information</h3>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>Test Name: <span className="font-medium">{testData.name}</span></li>
                        <li>Total Questions: <span className="font-medium">{testData.total_questions}</span></li>
                        <li>Duration: <span className="font-medium">{testData.duration} minutes</span></li>
                        <li>Subject(s): <span className="font-medium">{testData.test_subject.join(', ')}</span></li>
                         {testData.testType === 'chapterwise' && testData.lesson && (
                            <li>Lesson: <span className="font-medium">{testData.lesson}</span></li>
                         )}
                    </ul>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-base mb-2 flex items-center"><CheckCircle className="h-5 w-5 mr-2 text-green-600"/>Important Points</h3>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>Ensure you have a stable internet connection throughout the test.</li>
                        <li>The timer will start as soon as you click "Proceed to Test".</li>
                        <li>Do not refresh the page or use the browser's back/forward buttons during the test.</li>
                        <li>Your answers will be automatically saved as you navigate between questions.</li>
                        <li>All questions are multiple-choice questions (MCQ) with a single correct answer.</li>
                        <li>Each question carries {testData.questions?.[0]?.marks || 1} mark(s). (Assuming marks are uniform)</li>
                        <li>There is no negative marking (Verify this as per actual test rules).</li>
                    </ul>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                     <h3 className="font-semibold text-base mb-2 flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-amber-600"/>Navigation & Submission</h3>
                     <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>Use the "Question Navigation Panel" to jump to any question.</li>
                        <li>Question statuses will be color-coded in the navigation panel:
                            <ul className="list-disc list-inside pl-5 mt-1 space-y-0.5">
                                <li><span className="font-semibold text-gray-500">Gray:</span> Not Visited</li>
                                <li><span className="font-semibold text-red-500">Red:</span> Unanswered</li>
                                <li><span className="font-semibold text-green-500">Green:</span> Answered</li>
                                <li><span className="font-semibold text-purple-500">Purple:</span> Marked for Review</li>
                                <li><span className="font-semibold text-blue-500">Blue (with tick):</span> Answered & Marked for Review</li>
                            </ul>
                        </li>
                        <li>Click "Mark for Review" to revisit a question later.</li>
                        <li>Click "Clear Response" to deselect your chosen option for the current question.</li>
                        <li>Once you have completed the test, click the "Submit Test" button.</li>
                        <li>A confirmation will be required before final submission.</li>
                        <li>Results will be displayed immediately after submission.</li>
                    </ul>
                </div>
                 <p className="text-center font-medium pt-2">All the best for your test!</p>
            </div>
        </ScrollArea>

        <AlertDialogFooter className="mt-6">
          <Button onClick={onProceed} size="lg" className="w-full sm:w-auto">
            Proceed to Test
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
