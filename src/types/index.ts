// src/types/index.ts

// Define academic statuses used in signup
export const academicStatuses = ["11th Class", "12th Class", "Dropper"] as const;
export type AcademicStatus = typeof academicStatuses[number];

// Define user models
export const userModels = ["free", "chapterwise", "full_length", "combo"] as const;
export type UserModel = typeof userModels[number];

// Define Pricing types (Used in GeneratedTest and potentially elsewhere)
export const pricingTypes = ["FREE", "PAID", "FREE_PREMIUM"] as const;
export type PricingType = typeof pricingTypes[number];

// Define Exam types (Used in Question Bank and PYQ) - Added more options
export const exams = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET", "WBJEE", "KCET", "BITSAT", "VITEEE", "CUET", "AIEEE", "Other"] as const;
export type ExamOption = typeof exams[number]; // Used in Question Bank

// Define Class Levels for Question Bank
export const classLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type ClassLevel = typeof classLevels[number];

// Interface for User Data (Stored in users.json)
export interface UserProfile {
  id: string; // User ID is now always a string (UUID or numeric string)
  email: string | null;
  password?: string; // Store hashed password
  name: string | null;
  phone: string | null;
  avatarUrl?: string | null; // Filename (e.g., avatar-userid-timestamp.png) stored relative to public/avatars
  referral?: string; // Optional referral code
  class: AcademicStatus | null; // Academic status
  model: UserModel; // User's subscription model
  role: 'Admin' | 'User'; // Role is now mandatory
  expiry_date: string | null; // ISO string date or null for free/admin
  createdAt?: string; // Optional ISO timestamp
  totalPoints?: number; // Add totalPoints field, optional for existing users
}

// Type for Context User (less sensitive data, includes avatar and points)
export type ContextUser = Omit<UserProfile, 'password'> | null; // Role is now part of UserProfile


// ---- Question Bank Types ----

export const questionTypes = ["image", "text"] as const;
export type QuestionType = typeof questionTypes[number];

export const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export const pyqShifts = ["S1", "S2", "Single"] as const; // Shift 1, Shift 2, or Single Shift Exam
export type PyqShift = typeof pyqShifts[number];


// Interface for Question Bank Item (stored in individual JSON files)
export interface QuestionBankItem {
  id: string;
  subject: string;
  lesson: string;
  class: ClassLevel;
  examType: ExamOption; // The primary exam this question is tagged for initially
  difficulty: DifficultyLevel;
  tags: string[];
  type: QuestionType;
  question: {
    text?: string | null;
    image?: string | null; // Filename relative to public/question_bank_images/{subject}/{lesson}/images/
  };
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct: "A" | "B" | "C" | "D";
  explanation: {
    text?: string | null;
    image?: string | null; // Filename relative to public/question_bank_images/{subject}/{lesson}/images/
  };
  marks: number; // Added marks field
  isPyq?: boolean; // Flag to indicate if it's a PYQ
  pyqDetails?: {
    exam: ExamOption; // The specific exam it appeared in
    date: string; // ISO date string (YYYY-MM-DD)
    shift: PyqShift; // S1, S2, or Single
  } | null;
  created: string; // ISO timestamp
  modified: string; // ISO timestamp
}


// ---- Generated Test Definition Types ----

// Reusing Academic Status for Audience
export type AudienceType = AcademicStatus; // Type remains the same

// Define Test Streams
export const testStreams = ["PCM", "PCB"] as const;
export type TestStream = typeof testStreams[number];


// Interface for individual question within a generated test JSON
export interface TestQuestion {
    id?: string; // Original question ID from bank, if applicable
    type?: QuestionType; // 'text' or 'image', from original question
    question_text?: string | null;        // Textual content of the question (MathJax)
    question_image_url?: string | null;   // Public URL to the question image (relative to /)
    options: string[];                    // Array of 4 option strings (may contain MathJax)
    answer: string;                       // Correct option key e.g., "A", "B" (NOT "Option A")
    marks: number;
    explanation_text?: string | null;     // Textual explanation (MathJax)
    explanation_image_url?: string | null;// Public URL to the explanation image (relative to /)
    explanation?: string | null; // Fallback for older data or text-only explanations
    question?: string | null; // Fallback for older question text storage
}


// Base interface for common generated test properties
interface BaseGeneratedTest {
    test_code: string;
    name: string;
    duration: number; // in minutes
    count: number; // Number of questions specified by user (for chapterwise), or calculated total (for full length)
    total_questions: number; // Actual total number of questions included
    type: PricingType; // FREE, PAID, FREE_PREMIUM
    audience: AudienceType;
    createdAt?: string; // ISO timestamp
    test_subject: string[]; // Subjects involved
}

// Interface for Chapterwise Test JSON (inherits BaseGeneratedTest)
export interface ChapterwiseTestJson extends BaseGeneratedTest {
    testType: 'chapterwise'; // Discriminator
    lesson: string;
    examFilter?: ExamOption | 'all'; // Optional exam filter used during generation
    questions: TestQuestion[]; // Directly embed questions

    // Ensure fields from FullLengthTestJson are not present or explicitly undefined
    physics?: undefined;
    chemistry?: undefined;
    maths?: undefined;
    biology?: undefined;
    stream?: undefined;
    weightage?: undefined;
}

// Interface for Full Length Test JSON (inherits BaseGeneratedTest)
export interface FullLengthTestJson extends BaseGeneratedTest {
    testType: 'full_length'; // Discriminator
    stream: TestStream;
    examFilter?: ExamOption | 'all'; // Optional exam filter used during generation
    weightage?: {
        physics: number;
        chemistry: number;
        maths?: number; // Optional based on stream
        biology?: number; // Optional based on stream
    };
    // Subject-specific question arrays
    physics?: TestQuestion[];
    chemistry?: TestQuestion[];
    maths?: TestQuestion[];
    biology?: TestQuestion[];

    // Ensure fields from ChapterwiseTestJson are not present or explicitly undefined
    questions?: undefined; // Full length tests have subject-specific arrays
    lesson?: undefined;
}

// Discriminated union for generated tests
export type GeneratedTest = ChapterwiseTestJson | FullLengthTestJson;


// ---- Test Taking Interface Types ----
export enum QuestionStatus {
  Unanswered = 'unanswered',
  Answered = 'answered',
  MarkedForReview = 'marked',
  AnsweredAndMarked = 'answered_marked',
  NotVisited = 'not_visited', // Default
}

export interface UserAnswer {
  questionId: string; // Original ID from QuestionBankItem
  selectedOption: string | null; // e.g., "A", "B", "C", "D", or null if unanswered
  status: QuestionStatus;
  timeTaken?: number; // Optional: time spent on this question
}

// Data structure for the actual test taking session BEFORE saving the report
export interface TestSession {
  testId: string; // Corresponds to test_code
  userId: string;
  startTime: number; // Timestamp (used as attemptTimestamp)
  endTime?: number; // Timestamp, set on submit
  answers: UserAnswer[]; // Array of user's answers during the session
}

// For displaying results summary or storing in the report JSON
// This is the structure saved to src/data/chapterwise-test-report/{userId}/{testCode}-{userId}-{startTime}.json
export interface TestResultSummary {
    testCode: string;
    userId: string;
    user?: Omit<UserProfile, 'password'>; // Add user profile for displaying name (Optional, may need fetching)
    testName: string;
    attemptTimestamp: number; // Unique ID for this attempt (startTime from TestSession)
    submittedAt: number; // endTime from TestSession
    duration: number; // Test duration in minutes (from definition)
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    score: number;
    totalMarks: number; // Add total marks possible for the test
    percentage: number;
    timeTakenMinutes: number; // Total time taken for the test
    pointsEarned?: number; // Points earned for THIS test attempt
    detailedAnswers: Array<{
        questionId: string; // Store original question ID
        questionIndex: number; // Index within this specific test attempt
        // Question content representation (one of these will be populated)
        questionText?: string | null; // MathJax format
        questionImageUrl?: string | null; // Relative URL
        options?: string[]; // Store options shown to user
        userAnswer: string | null; // e.g. "A"
        correctAnswer: string; // e.g. "C"
        isCorrect: boolean;
        status: QuestionStatus;
        // Explanation content (one of these might be populated)
        explanationText?: string | null; // MathJax format
        explanationImageUrl?: string | null; // Relative URL
        marks?: number; // Marks for this specific question
    }>;
}

// ---- Short Notes Types ----
export interface ShortNote {
    id: string; // Unique identifier for the note (e.g., timestamp or UUID)
    title: string;
    description: string;
    subject: string;
    examType: ExamOption;
    contentType: 'pdf' | 'html'; // Type of content
    filePath: string; // Path relative to public/short_notes/{pdf_pages|html_pages}/
    createdAt: string; // ISO timestamp
    modifiedAt: string; // ISO timestamp
}

// Interface for the JSON file storing note metadata per subject/exam
export interface ShortNotesMetadata {
    subject: string;
    examType: ExamOption;
    notes: ShortNote[];
}

// ---- DPP Progress Tracking Types ----

// Represents a single attempt on a DPP question
export interface DppAttempt {
  timestamp: number; // Unix timestamp of the attempt
  selectedOption: string | null; // "A", "B", "C", "D", or null if skipped/cleared
  isCorrect: boolean;
}

// Structure for storing a user's progress on a specific DPP lesson
// This will be the content of the file: src/data/user-dpp-progress/{userId}/{subject}/{lesson}.json
export interface UserDppLessonProgress {
  userId: string;
  subject: string;
  lesson: string;
  lastAccessed?: number; // Optional: timestamp of last access
  // Map where key is questionId and value is an array of attempts
  questionAttempts: Record<string, DppAttempt[]>;
}

// ---- Notebook / Bookmark Types ----

// Interface for a single Notebook created by the user
export interface Notebook {
  id: string; // Unique ID for the notebook (e.g., UUID)
  name: string;
  createdAt: number; // Timestamp
}

// Interface for a bookmarked question within a notebook
export interface BookmarkedQuestion {
  questionId: string; // ID linking back to the QuestionBankItem
  subject: string;    // Subject of the question
  lesson: string;     // Lesson of the question
  addedAt: number;    // Timestamp when bookmarked
  tags?: BookmarkTag[];    // Use specific BookmarkTag type
}

// Interface for the user's entire notebook data structure
// This will be the content of src/data/user-notebooks/{userId}/notebooks.json
export interface UserNotebookData {
  userId: string;
  notebooks: Notebook[];
  // Maps notebookId to an array of bookmarked questions in that notebook
  bookmarkedQuestions: Record<string, BookmarkedQuestion[]>;
}

// Default tags for bookmarking
export const bookmarkTags = ["Easy", "Hard", "Tricky", "Do Again", "Important"] as const;
export type BookmarkTag = typeof bookmarkTags[number];
