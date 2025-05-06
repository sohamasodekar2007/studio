// src/app/admin/questions/edit/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Filter, Edit, Trash2, Eye, FileText, Image as ImageIcon, Loader2 } from "lucide-react"; // Renamed Image icon
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem, ExamOption, ClassLevel } from '@/types';
import { examOptions, classLevels } from '@/types'; // Import filter options
import { Badge } from "@/components/ui/badge"; // Import Badge component
// Import the actual server actions
import { getSubjects, getLessonsForSubject, getQuestionsForLesson, deleteQuestion } from '@/actions/question-bank-query-actions';

export default function EditQuestionsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true); // Renamed for clarity
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Filter State ---
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<ClassLevel | 'all'>('all');
  const [selectedExam, setSelectedExam] = useState<ExamOption | 'all'>('all');
  const [useBothFilters, setUseBothFilters] = useState(false); // Kept for potential future use
  // --- End Filter State ---


  // --- Fetch Initial Data (Subjects) ---
  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(setSubjects)
      .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  // --- Fetch Lessons when Subject Changes ---
  useEffect(() => {
    if (selectedSubject) {
      setIsLoadingLessons(true);
      setLessons([]); // Clear previous lessons
      setSelectedLesson(''); // Reset lesson selection
      setQuestions([]); // Clear questions too
      getLessonsForSubject(selectedSubject)
        .then(setLessons)
        .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
        .finally(() => setIsLoadingLessons(false));
    } else {
      setLessons([]); // Clear lessons if no subject selected
      setSelectedLesson('');
      setQuestions([]); // Clear questions if no subject selected
    }
  }, [selectedSubject, toast]);

  // --- Fetch Questions when Subject AND Lesson Change (and other filters) ---
   useEffect(() => {
     // Only fetch if subject AND lesson are selected
     if (selectedSubject && selectedLesson) {
       setIsLoadingQuestions(true);
       setQuestions([]); // Clear previous questions

       // Build filter object based on state
       const filters = {
         subject: selectedSubject,
         lesson: selectedLesson,
         class: selectedClass !== 'all' ? selectedClass : undefined,
         examType: selectedExam !== 'all' ? selectedExam : undefined,
         // Add 'useBoth' or similar logic if needed based on the toggle state
       };

       console.log("Fetching questions with filters:", filters);

       getQuestionsForLesson(filters) // Pass the filter object
         .then(setQuestions)
         .catch(err => {
            console.error("Error loading questions:", err);
            toast({ variant: "destructive", title: "Error", description: "Could not load questions." })
         })
         .finally(() => setIsLoadingQuestions(false));
     } else {
       setQuestions([]); // Clear questions if subject or lesson is not selected
     }
   }, [selectedSubject, selectedLesson, selectedClass, selectedExam, useBothFilters, toast]);


  // --- Filtered Questions for Display (using search term) ---
  const displayQuestions = useMemo(() => {
    return questions.filter(q =>
      (q.question.text?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (q.tags?.join(' ')?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
       q.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [questions, searchTerm]);

   // --- Action Handlers ---
   const handleEdit = (id: string) => {
     console.log("Edit question:", id);
     toast({ title: "Edit Action", description: `Edit functionality for ${id} coming soon.` });
     // TODO: Implement inline editing or open a modal/dialog using the actual question data
   };

   const handleDelete = async (id: string, subject: string, lesson: string) => {
     console.log("Delete question:", id, subject, lesson);
     if (confirm(`Are you sure you want to delete question ${id} from ${subject}/${lesson}? This cannot be undone.`)) {
       try {
         const result = await deleteQuestion({ questionId: id, subject, lesson }); // Pass parameters as an object
         if (result.success) {
           toast({ title: "Question Deleted", description: `${id} has been removed.` });
           // Re-fetch questions for the current filters after deletion
           setIsLoadingQuestions(true);
            const filters = {
                subject: selectedSubject,
                lesson: selectedLesson,
                class: selectedClass !== 'all' ? selectedClass : undefined,
                examType: selectedExam !== 'all' ? selectedExam : undefined,
            };
           getQuestionsForLesson(filters)
            .then(setQuestions)
            .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not reload questions." }))
            .finally(() => setIsLoadingQuestions(false));
         } else {
           throw new Error(result.message || 'Failed to delete question.');
         }
       } catch (error: any) {
         toast({ variant: "destructive", title: "Delete Failed", description: error.message });
       }
     }
   };

    const renderQuestionPreview = (q: QuestionBankItem) => {
        if (q.type === 'image') {
            // TODO: Fetch actual image path or show placeholder correctly
            // const imagePath = `/data/question_bank/${q.subject}/${q.lesson}/images/${q.question.image}`; // Adjust path as needed
            return <span className="flex items-center gap-1 text-blue-600"><ImageIcon className="h-4 w-4"/> [Image Question]</span>;
        }
        const text = q.question.text || '[No Text]';
        // Basic MathJax preview (relies on MathJax being loaded globally)
        return <span className="line-clamp-1" title={text} dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') || '[No Text]' }}></span>;
    }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Questions</h1>
          <p className="text-muted-foreground">Filter, view, edit, and manage questions in the bank.</p>
        </div>
        {/* Maybe add bulk actions button here later */}
      </div>

      {/* Filter Panel */}
       <Card>
         <CardHeader>
             <CardTitle>Filter Questions</CardTitle>
         </CardHeader>
         <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Subject Dropdown */}
            <div className="space-y-1.5">
             <Label htmlFor="subject-filter">Subject *</Label>
             <Select
               value={selectedSubject}
               onValueChange={(value) => {
                 setSelectedSubject(value);
                 // Reset dependent filters handled by useEffect
               }}
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

            {/* Lesson Dropdown */}
            <div className="space-y-1.5">
                <Label htmlFor="lesson-filter">Lesson *</Label>
                <Select
                    value={selectedLesson}
                    onValueChange={(value) => {
                        setSelectedLesson(value);
                        // Reset questions handled by useEffect
                    }}
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

            {/* Class Filter */}
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

              {/* Exam Filter */}
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
                        {examOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}
                    </SelectContent>
                </Select>
             </div>

             {/* 'Use Both Filters' Toggle - kept for potential future implementation */}
             {/* <div className="flex items-center space-x-2 sm:col-span-2 md:col-span-1 lg:col-span-1 justify-self-start pt-5">
                 <Checkbox
                    id="use-both-filters"
                    checked={useBothFilters}
                    onCheckedChange={(checked) => setUseBothFilters(Boolean(checked))}
                    disabled={!selectedSubject || !selectedLesson || selectedClass === 'all' || selectedExam === 'all'}
                 />
                 <Label htmlFor="use-both-filters" className="text-sm text-muted-foreground">Use Class & Exam Together</Label>
             </div> */}

         </CardContent>
         {/* Footer button for manual load removed, loads automatically via useEffect */}
       </Card>

      {/* Question Table */}
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
                  disabled={questions.length === 0 && !isLoadingQuestions && (!selectedSubject || !selectedLesson)} // Disable if no lesson selected or no questions
                />
            </div>
         </CardHeader>
          <CardContent>
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
                        {/* Add Marks later if needed */}
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingQuestions ? (
                        Array.from({ length: 5 }).map((_, index) => ( // Increased skeleton rows
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
                                <DropdownMenuItem onClick={() => handleEdit(q.id)} disabled> {/* Keep edit disabled for now */}
                                    <Edit className="mr-2 h-4 w-4" /> Edit Question
                                </DropdownMenuItem>
                                {/* Add other actions like View Full, Clone later */}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDelete(q.id, q.subject, q.lesson)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Question
                                </DropdownMenuItem>
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
             {/* TODO: Add Pagination */}
          </CardContent>
           <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{displayQuestions.length}</strong> of <strong>{questions.length}</strong> loaded questions.
              </div>
           </CardFooter>
       </Card>

    </div>
  );
}
