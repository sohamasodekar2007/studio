'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Construction, FileText, Upload, X, ClipboardPaste, Check, ChevronsUpDown, FileJson } from "lucide-react";
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions'; // Import query actions
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FormEvent, useCallback } from 'react';
import { type QuestionBankItem, QuestionType, DifficultyLevel, ExamOption, ClassLevel } from '@/types';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { ShortNotesItem, ExamOption, ClassLevel } from '@/types';
import { examOptions, classLevels } from '@/types';
import { deleteQuestion } from '@/actions/question-bank-query-actions';
import { addQuestionToBank } from '@/actions/question-bank-actions'; // Import the server action
import { List } from 'lucide-react'; // Import List
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// MathJax

export default function AdminNotesPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<ClassLevel | 'all'>('all');
  const [selectedExam, setSelectedExam] = useState<ExamOption | 'all'>('all');

  const router = useRouter();

  const fetchSubjects = useCallback(async () => {
    setIsLoadingSubjects(true);
    try {
      const fetchedSubjects = await getSubjects();
      setSubjects(fetchedSubjects);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not load subjects." });
      setSubjects([]);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const fetchLessons = useCallback(async () => {
    if (selectedSubject) {
      setIsLoadingLessons(true);
      setLessons([]);
      setQuestions([]);
      try {
        const fetchedLessons = await getLessonsForSubject(selectedSubject);
        setLessons(fetchedLessons);
        setSelectedLesson('');
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` });
        setLessons([]);
      } finally {
        setIsLoadingLessons(false);
      }
    } else {
      setLessons([]);
      setSelectedLesson('');
      setQuestions([]);
    }
  }, [selectedSubject, toast]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const fetchQuestions = useCallback(async () => {
    if (selectedSubject && selectedLesson) {
      setIsLoadingQuestions(true);
      setQuestions([]);
      const filters = {
        subject: selectedSubject,
        lesson: selectedLesson,
        class: selectedClass !== 'all' ? selectedClass : undefined,
        examType: selectedExam !== 'all' ? selectedExam : undefined,
      };
      try {
        const fetchedQuestions = await getQuestionsForLesson(filters);
        setQuestions(fetchedQuestions);
      } catch (err) {
        console.error("Error loading questions:", err);
        toast({ variant: "destructive", title: "Error", description: "Could not load questions." });
        setQuestions([]);
      } finally {
        setIsLoadingQuestions(false);
      }
    } else {
      setQuestions([]);
    }
  }, [selectedSubject, selectedLesson, selectedClass, selectedExam, toast]);

  useEffect(() => {
    if (selectedSubject && selectedLesson) {
      fetchQuestions();
    } else {
      setQuestions([]);
      setIsLoadingQuestions(false);
    }
  }, [selectedSubject, selectedLesson, selectedClass, selectedExam, fetchQuestions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Short Notes Management</h1>
      </div>

      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Short notes management features are currently under development.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
