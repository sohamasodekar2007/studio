// src/app/admin/questions/edit/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Edit, Trash2, FileText, ImageIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem, ExamOption, ClassLevel } from '@/types';
import { exams, classLevels } from '@/types';
import { Badge } from "@/components/ui/badge";
import { getSubjects, getLessonsForSubject, getQuestionsForLesson, deleteQuestion } from '@/actions/question-bank-query-actions';
import EditQuestionDialog from '@/components/admin/edit-question-dialog';
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
} from "@/components/ui/alert-dialog"
import Script from 'next/script';
import Image from 'next/image';

const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images';
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};


export default function EditQuestionsPage() {
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

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
        const elements = document.querySelectorAll('.mathjax-content-preview'); // Use a specific class for previews
        if (elements.length > 0) {
            (window as any).MathJax.typesetPromise(Array.from(elements))
                .catch((err: any) => console.error("MathJax typeset error (preview):", err));
        }
    }
  }, []);

  useEffect(() => {
    if (!isLoadingQuestions && questions.length > 0) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [isLoadingQuestions, questions, typesetMathJax]);


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

    const handleQuestionUpdate = useCallback((updatedQuestion: QuestionBankItem) => {
        setQuestions(prevQuestions =>
            prevQuestions.map(q => (q.id === updatedQuestion.id ? updatedQuestion : q))
        );
        setIsEditDialogOpen(false);
        setEditingQuestion(null);
        // No need to call typesetMathJax here as the main useEffect for questions will handle it.
    }, []);


  const displayQuestions = useMemo(() => {
    return questions.filter(q =>
      (q.question.text?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (q.tags?.join(' ')?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
       q.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [questions, searchTerm]);

   const handleEdit = (question: QuestionBankItem) => {
        setEditingQuestion(question);
        setIsEditDialogOpen(true);
   };

   const handleDelete = async (id: string, subject: string, lesson: string) => {
     try {
         const result = await deleteQuestion({ questionId: id, subject, lesson });
         if (result.success) {
           toast({ title: "Question Deleted", description: `${id} has been removed.` });
           await fetchQuestions(); 
         } else {
           throw new Error(result.message || 'Failed to delete question.');
         }
       } catch (error: any) {
         toast({ variant: "destructive", title: "Delete Failed", description: error.message });
       }
   };

    const renderQuestionPreview = (q: QuestionBankItem) => {
        const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);
        if (q.type === 'image' && imagePath) {
            return (
                <span className="flex items-center gap-1 text-blue-600 hover:underline" title={`View Image: ${q.question.image}`}>
                    <ImageIcon className="h-4 w-4"/>
                    <span className="font-mono text-xs">({q.id})</span>
                </span>
            );
        }
        const text = q.question.text || '[No Text]';
        return (
            <span
                className="line-clamp-1 mathjax-content-preview" // Add specific class for preview typesetting
                title={text}
                dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
            />
        );
    }


  return (
    <>
     <Script
        id="mathjax-script-edit-questions"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
          typesetMathJax(); 
        }}
      />
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Questions</h1>
          <p className="text-muted-foreground">Filter, view, edit, and manage questions in the bank.</p>
        </div>
      </div>

       <Card>
         <CardHeader>
             <CardTitle>Filter Questions</CardTitle>
         </CardHeader>
         <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
             <Label htmlFor="subject-filter">Subject *</Label>
             <Select
               value={selectedSubject}
               onValueChange={setSelectedSubject}
               disabled={isLoadingSubjects}
             >
               <SelectTrigger id="subject-filter">
                 <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} />
               </SelectTrigger>
               <SelectContent>
                 {subjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                 {isLoadingSubjects && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                 {!isLoadingSubjects && subjects.length === 0 && <SelectItem value="no-subjects" disabled>No subjects found</SelectItem>}
               </SelectContent>
             </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="lesson-filter">Lesson *</Label>
                <Select
                    value={selectedLesson}
                    onValueChange={setSelectedLesson}
                    disabled={isLoadingLessons || !selectedSubject || subjects.length === 0}
                >
                    <SelectTrigger id="lesson-filter">
                    <SelectValue placeholder={isLoadingLessons ? "Loading..." : (!selectedSubject ? "Select Subject First" : "Select Lesson")} />
                    </SelectTrigger>
                    <SelectContent>
                    {lessons.map(lesson => <SelectItem key={lesson} value={lesson}>{lesson}</SelectItem>)}
                    {isLoadingLessons && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                    {!isLoadingLessons && lessons.length === 0 && selectedSubject && <SelectItem value="no-lessons" disabled>No lessons found</SelectItem>}
                    </SelectContent>
                </Select>
             </div>

            <div className="space-y-1.5">
                <Label htmlFor="class-filter">Class</Label>
                <Select
                    value={selectedClass}
                    onValueChange={(value) => setSelectedClass(value as ClassLevel | 'all')}
                    disabled={!selectedSubject || !selectedLesson}
                >
                    <SelectTrigger id="class-filter">
                    <SelectValue placeholder="Filter by Class" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>

             <div className="space-y-1.5">
                <Label htmlFor="exam-filter">Exam Type</Label>
                <Select
                    value={selectedExam}
                    onValueChange={(value) => setSelectedExam(value as ExamOption | 'all')}
                    disabled={!selectedSubject || !selectedLesson}
                >
                    <SelectTrigger id="exam-filter">
                    <SelectValue placeholder="Filter by Exam" />
                    </SelectTrigger>
                    <SelectContent>
                         <SelectItem value="all">All Exam Types</SelectItem>
                         {exams.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>
         </CardContent>
       </Card>

       <Card>
         <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
                <CardTitle>Question List</CardTitle>
                 <CardDescription>
                    {selectedSubject && selectedLesson
                        ? `Showing questions for: ${selectedSubject} > ${selectedLesson}`
                        : 'Select Subject and Lesson above to view questions.'}
                 </CardDescription>
            </div>
             <div className="relative flex-1 md:grow-0 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, text, tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={questions.length === 0 && !isLoadingQuestions && (!selectedSubject || !selectedLesson)}
                />
            </div>
         </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[150px]">ID</TableHead>
                          <TableHead>Question Preview</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Exam</TableHead>
                          <TableHead>Difficulty</TableHead>
                          <TableHead>Correct Ans</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoadingQuestions ? (
                          Array.from({ length: 5 }).map((_, index) => (
                          <TableRow key={`skel-${index}`}>
                              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                          ))
                      ) : displayQuestions.length > 0 ? (
                          displayQuestions.map((q) => (
                          <TableRow key={q.id}>
                              <TableCell className="font-mono text-xs">{q.id}</TableCell>
                              <TableCell>{renderQuestionPreview(q)}</TableCell>
                              <TableCell>
                                <Badge variant={q.type === 'text' ? 'secondary' : 'outline'} className="capitalize">
                                    {q.type === 'text' ? <FileText className="h-3 w-3 mr-1"/> : <ImageIcon className="h-3 w-3 mr-1"/>}
                                    {q.type}
                                  </Badge>
                              </TableCell>
                              <TableCell>{q.class}</TableCell>
                              <TableCell>{q.examType}</TableCell>
                              <TableCell>{q.difficulty}</TableCell>
                              <TableCell className="font-medium text-center">{q.correct}</TableCell>
                              <TableCell className="text-right">
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                  <Button aria-haspopup="true" size="icon" variant="ghost">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Toggle menu</span>
                                  </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleEdit(q)}>
                                      <Edit className="mr-2 h-4 w-4" /> Edit Question
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                          <Button
                                              variant="ghost"
                                              className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                          >
                                              <Trash2 className="mr-2 h-4 w-4" /> Delete Question
                                          </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                          <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              This will permanently delete question <span className="font-mono text-xs">{q.id}</span> from {q.subject}/{q.lesson}. This action cannot be undone.
                                          </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(q.id, q.subject, q.lesson)} className="bg-destructive hover:bg-destructive/90">
                                              Yes, delete
                                          </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                              </TableCell>
                          </TableRow>
                          ))
                      ) : (
                          <TableRow>
                              <TableCell colSpan={8} className="h-24 text-center">
                                  {(!selectedSubject || !selectedLesson)
                                      ? "Please select a Subject and Lesson to view questions."
                                      : "No questions found matching your filters."}
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
            </div>
          </CardContent>
           <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{displayQuestions.length}</strong> of <strong>{questions.length}</strong> loaded questions.
              </div>
           </CardFooter>
       </Card>

        {editingQuestion && (
            <EditQuestionDialog
                question={editingQuestion}
                isOpen={isEditDialogOpen}
                onClose={() => {
                    setIsEditDialogOpen(false);
                    setEditingQuestion(null);
                }}
                onQuestionUpdate={handleQuestionUpdate}
            />
        )}
    </div>
    </>
  );
}
