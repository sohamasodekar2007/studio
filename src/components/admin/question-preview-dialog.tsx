// src/components/admin/question-preview-dialog.tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { QuestionBankItem } from '@/types';
import Image from 'next/image';
import Script from 'next/script';
import { useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface QuestionPreviewDialogProps {
  question: QuestionBankItem | null;
  isOpen: boolean;
  onClose: () => void;
  constructImagePath: (subject: string, lesson: string, filename: string | null | undefined) => string | null;
}

export default function QuestionPreviewDialog({ question, isOpen, onClose, constructImagePath }: QuestionPreviewDialogProps) {
  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
      const elements = document.querySelectorAll('.mathjax-preview-dialog');
      if (elements.length > 0) {
        (window as any).MathJax.typesetPromise(Array.from(elements))
          .catch((err: any) => console.error("MathJax typeset error (preview dialog):", err));
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen && question) {
      const timerId = setTimeout(() => typesetMathJax(), 50);
      return () => clearTimeout(timerId);
    }
  }, [isOpen, question, typesetMathJax]);

  if (!question) return null;

  const renderQuestionContent = (q: QuestionBankItem) => {
    const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);
    if (q.type === 'image' && imagePath) {
      return (
        <div className="relative w-full max-w-md h-56 mx-auto my-2">
          <Image
            src={imagePath}
            alt={`Question Image: ${q.id}`}
            layout="fill"
            objectFit="contain"
            className="rounded border"
            data-ai-hint="question diagram"
            unoptimized
          />
        </div>
      );
    } else if (q.type === 'text' && q.question.text) {
      return (
        <div
          className="prose dark:prose-invert max-w-none mathjax-preview-dialog"
          dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
        />
      );
    }
    return <p className="text-muted-foreground">Question content not available.</p>;
  };

  return (
    <>
    <Script
      id="mathjax-script-q-preview-dialog" // Unique ID
      src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
      strategy="lazyOnload"
      onLoad={() => {
         if (isOpen) typesetMathJax();
      }}
    />
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Question Preview: {question.id}</DialogTitle>
          <DialogDescription>
            Subject: {question.subject} | Lesson: {question.lesson} | Type: {question.type}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1 pr-3 -mr-3">
            <div className="space-y-4 py-4 mathjax-preview-dialog">
            {renderQuestionContent(question)}
            <div className="mt-4 space-y-2">
                <p className="font-medium text-sm">Options:</p>
                <ul className="list-none space-y-1 pl-2 text-sm">
                    <li><span className="font-semibold">A:</span> <span dangerouslySetInnerHTML={{ __html: (question.options.A || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                    <li><span className="font-semibold">B:</span> <span dangerouslySetInnerHTML={{ __html: (question.options.B || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                    <li><span className="font-semibold">C:</span> <span dangerouslySetInnerHTML={{ __html: (question.options.C || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                    <li><span className="font-semibold">D:</span> <span dangerouslySetInnerHTML={{ __html: (question.options.D || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                </ul>
                <p className="font-medium text-sm mt-2">Correct Answer: <span className="font-bold text-primary">{question.correct}</span></p>
                <p className="font-medium text-sm">Marks: <span className="font-bold">{question.marks}</span></p>
            </div>
            {(question.explanation.text || question.explanation.image) && (
                <div className="mt-4 pt-4 border-t">
                <p className="font-medium text-sm mb-1">Explanation:</p>
                {question.explanation.text && (
                     <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: question.explanation.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                )}
                {question.explanation.image && (
                    <div className="relative w-full max-w-md h-48 mx-auto mt-2">
                    <Image
                        src={constructImagePath(question.subject, question.lesson, question.explanation.image)}
                        alt="Explanation Image"
                        layout="fill"
                        objectFit="contain"
                        className="rounded border"
                        data-ai-hint="explanation diagram"
                        unoptimized
                    />
                    </div>
                )}
                </div>
            )}
            </div>
        </ScrollArea>
        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
