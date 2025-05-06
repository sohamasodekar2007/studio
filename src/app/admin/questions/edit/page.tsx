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
import { MoreHorizontal, Search, Filter, Edit, Trash2, Eye, FileText, Image as ImageIcon } from "lucide-react"; // Renamed Image icon
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem, ExamOption, ClassLevel } from '@/types';
import { examOptions, classLevels } from '@/types'; // Import filter options
import { Badge } from "@/components/ui/badge"; // Import Badge component

// Placeholder for server actions (implement later)
async function getSubjects(): Promise<string[]> {
  console.warn("getSubjects action not implemented, returning placeholder data.");
  return ["Physics", "Chemistry", "Maths", "Biology"]; // Placeholder
}
async function getLessons(subject: string): Promise<string[]> {
  console.warn(`getLessons action for ${subject} not implemented, returning placeholder data.`);
   // In a real app, read directories under src/data/question_bank/{subject}
   if (subject === 'Physics') return ['Kinematics', 'Work Energy Power', 'Rotational Motion'];
   if (subject === 'Chemistry') return ['Mole Concept', 'Atomic Structure', 'Chemical Bonding'];
   return ['Lesson A', 'Lesson B']; // Placeholder
}
async function getQuestions(filters: any): Promise<QuestionBankItem[]> {
   console.warn("getQuestions action not implemented, returning placeholder data.");
   // In a real app, read JSON files based on filters
   // This is complex and needs server-side logic to traverse directories and filter JSON content.
   // Returning static data for UI layout purposes.
   const placeholderQuestions: QuestionBankItem[] = [
    {
        id: "Q_1715000000001", subject: "Physics", lesson: "Kinematics", class: "11", examType: "JEE Main", difficulty: "Medium", tags: ["motion", "1d"], type: "text",
        question: { text: "A particle moves with constant velocity $v$. What is its acceleration?", image: null },
        options: { A: "$0$", B: "$g$", C: "$v^2/r$", D: "Cannot be determined" }, correct: "A",
        explanation: { text: "Constant velocity means zero acceleration.", image: null }, created: "2024-05-06T10:00:00Z", modified: "2024-05-06T10:00:00Z"
    },
     {
        id: "Q_1715000000002", subject: "Chemistry", lesson: "Mole Concept", class: "11", examType: "NEET", difficulty: "Easy", tags: ["stoichiometry"], type: "text",
        question: { text: "Calculate the number of moles in 22g of CO2.", image: null },
        options: { A: "0.5", B: "1", C: "2", D: "0.25" }, correct: "A",
        explanation: { text: "Molar mass of CO2 = 12 + 2*16 = 44g/mol. Moles = 22g / 44g/mol = 0.5 mol.", image: null }, created: "2024-05-06T10:05:00Z", modified: "2024-05-06T10:05:00Z"
    },
    {
        id: "Q_1715000000003", subject: "Physics", lesson: "Work Energy Power", class: "12", examType: "JEE Advanced", difficulty: "Hard", tags: ["work", "variable force"], type: "image",
        question: { text: null, image: "Q_placeholder.png" }, // Placeholder image filename
        options: { A: "A", B: "B", C: "C", D: "D" }, correct: "C",
        explanation: { text: "Explanation involves integration...", image: "E_placeholder.png" }, created: "2024-05-06T10:10:00Z", modified: "2024-05-06T10:10:00Z"
    },
   ];
    return new Promise(resolve => setTimeout(() => resolve(placeholderQuestions), 500)); // Simulate network delay
}
async function deleteQuestionAction(id: string): Promise<{ success: boolean; message?: string }> {
   console.warn(`deleteQuestionAction for ${id} not implemented.`);
   // In a real app, delete the JSON file and associated images.
   return { success: true };
}
// Add updateQuestionAction later

export default function EditQuestionsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Filter State ---
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<ClassLevel | 'all'>('all');
  const [selectedExam, setSelectedExam] = useState<ExamOption | 'all'>('all');
  const [useBothFilters, setUseBothFilters] = useState(false);
  // --- End Filter State ---


  // --- Fetch Initial Data ---
  useEffect(() => {
    setIsLoading(true);
    getSubjects()
      .then(setSubjects)
      .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
      .finally(() => setIsLoading(false));
  }, [toast]);

  // --- Fetch Lessons when Subject Changes ---
  useEffect(() => {
    if (selectedSubject) {
      setIsLoadingLessons(true);
      setLessons([]); // Clear previous lessons
      setSelectedLesson(''); // Reset lesson selection
      getLessons(selectedSubject)
        .then(setLessons)
        .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
        .finally(() => setIsLoadingLessons(false));
    } else {
      setLessons([]); // Clear lessons if no subject selected
      setSelectedLesson('');
    }
  }, [selectedSubject, toast]);

  // --- Fetch Questions when Filters Change ---
   useEffect(() => {
     // Only fetch if subject AND lesson are selected
     if (selectedSubject && selectedLesson) {
       setIsLoadingQuestions(true);
       setQuestions([]); // Clear previous questions

       // Build filter object based on state
       const filters: any = {
         subject: selectedSubject,
         lesson: selectedLesson,
       };
       if (selectedClass !== 'all') filters.class = selectedClass;
       if (selectedExam !== 'all') filters.examType = selectedExam;
       // Note: 'useBothFilters' toggle doesn't directly change the filter object structure here,
       // it's more about how the UI presents the options. The backend/action needs to handle
       // the AND logic if both class and exam are provided.

       console.log("Fetching questions with filters:", filters);

       getQuestions(filters)
         .then(setQuestions)
         .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load questions." }))
         .finally(() => setIsLoadingQuestions(false));
     } else {
       setQuestions([]); // Clear questions if subject or lesson is not selected
     }
   }, [selectedSubject, selectedLesson, selectedClass, selectedExam, useBothFilters, toast]);


  // --- Filtered Questions for Display ---
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
     // TODO: Implement inline editing or open a modal/dialog
   };

   const handleDelete = async (id: string, subject: string, lesson: string) => {
     console.log("Delete question:", id);
     if (confirm(`Are you sure you want to delete question ${id} from ${subject}/${lesson}? This cannot be undone.`)) {
       try {
         const result = await deleteQuestionAction(id);
         if (result.success) {
           toast({ title: "Question Deleted", description: `${id} has been removed.` });
           // Re-fetch questions after deletion
           setIsLoadingQuestions(true);
           getQuestions({ subject: selectedSubject, lesson: selectedLesson, class: selectedClass, examType: selectedExam })
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
            return <span className="flex items-center gap-1 text-blue-600"><ImageIcon className="h-4 w-4"/> [Image Question]</span>;
        }
        const text = q.question.text || '[No Text]';
        return <span className="line-clamp-1" title={text}>{text}</span>;
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
                 // Reset dependent filters
                 setSelectedLesson('');
                 setLessons([]);
                 setQuestions([]);
               }}
               disabled={isLoading}
             >
               <SelectTrigger id="subject-filter">
                 <SelectValue placeholder="Select Subject" />
               </SelectTrigger>
               <SelectContent>
                 {subjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                 {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
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
                         setQuestions([]); // Clear questions when lesson changes
                    }}
                    disabled={isLoadingLessons || !selectedSubject}
                >
                    <SelectTrigger id="lesson-filter">
                    <SelectValue placeholder={isLoadingLessons ? "Loading..." : "Select Lesson"} />
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

              {/* TODO: Add 'Use Both Filters' Toggle - needs careful implementation */}
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
         {/* <CardFooter>
             <Button onClick={fetchFilteredQuestions} disabled={isLoadingQuestions || !selectedSubject || !selectedLesson}>
                {isLoadingQuestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Load Questions
             </Button>
         </CardFooter> */}
       </Card>

      {/* Question Table */}
       <Card>
         <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
                <CardTitle>Question List</CardTitle>
                 <CardDescription>Showing questions for: {selectedSubject && selectedLesson ? `${selectedSubject} > ${selectedLesson}` : 'Select Subject and Lesson'}</CardDescription>
            </div>
             <div className="relative flex-1 md:grow-0 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, text, tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={questions.length === 0 && !isLoadingQuestions}
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
                        {/* Add Marks later */}
                        {/* <TableHead>Marks</TableHead> */}
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingQuestions ? (
                        Array.from({ length: 3 }).map((_, index) => (
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
                             {/* <TableCell>Marks Placeholder</TableCell> */}
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
                                <DropdownMenuItem onClick={() => handleEdit(q.id)} disabled> {/* Disable edit for now */}
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
                                {(!selectedSubject || !selectedLesson) ? "Please select a Subject and Lesson to view questions." : "No questions found matching your filters."}
                            </TableCell>
                         </TableRow>
                     )}
                </TableBody>
            </Table>
             {/* TODO: Add Pagination */}
          </CardContent>
           <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{displayQuestions.length}</strong> questions.
              </div>
           </CardFooter>
       </Card>

    </div>
  );
}
