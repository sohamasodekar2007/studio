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

// Define Exam types (Used in Question Bank)
export const exams = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET", "Other"] as const;
export type ExamOption = typeof exams[number]; // Used in Question Bank

export const classLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type ClassLevel = typeof classLevels[number];

// Interface for User Data (Stored in users.json)
export interface UserProfile {
  id: string; // User ID is now always a string (UUID)
  email: string | null;
  password?: string; // Store hashed password in production
  name: string | null;
  phone: string | null;
  referral?: string; // Optional referral code
  class: AcademicStatus | null; // Academic status
  model: UserModel; // User's subscription model
  expiry_date: string | null; // ISO string date or null for free/admin
  createdAt?: string; // Optional ISO timestamp
}

// Type for Context User (less sensitive data)
export type ContextUser = Omit<UserProfile, 'password'> | null;

// ---- Question Bank Types (Remain largely the same) ----

export const questionTypes = ["image", "text"] as const;
export type QuestionType = typeof questionTypes[number];

export const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];


// Interface for Question Bank Item (stored in individual JSON files)
export interface QuestionBankItem {
  id: string;
  subject: string;
  lesson: string;
  class: ClassLevel;
  examType: ExamOption;
  difficulty: DifficultyLevel;
  tags: string[];
  type: QuestionType;
  question: {
    text?: string | null;
    image?: string | null; // Filename
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
    image?: string | null; // Filename
  };
  created: string; // ISO timestamp
  modified: string; // ISO timestamp
}


// ---- Generated Test Definition Types ----

// Define Audience Types (reusing Academic Status)
export const audienceTypes = academicStatuses; // Use the same const for audience
export type AudienceType = AcademicStatus; // Type remains the same

// Define Test Streams
export const testStreams = ["PCM", "PCB"] as const;
export type TestStream = typeof testStreams[number];


// Interface for individual question within a generated test JSON
export interface TestQuestion {
    id?: string; // Original question ID from bank, if applicable
    type?: QuestionType; // 'text' or 'image', from original question
    question_text?: string | null;        // Textual content of the question
    question_image_url?: string | null;   // Public URL to the question image
    options: string[];                    // Array of 4 option strings
    answer: string;                       // Correct option key e.g., "A", "B" (NOT "Option A")
    marks: number;
    explanation_text?: string | null;     // Textual explanation
    explanation_image_url?: string | null;// Public URL to the explanation image
    explanation?: string | null; // Fallback for older data or text-only explanations
    question?: string | null; // Fallback for older question text storage
}


// Base interface for common generated test properties
interface BaseGeneratedTest {
    test_code: string;
    name: string;
    duration: number; // in minutes
    count: number; // Number of questions selected/specified by user
    total_questions: number; // Actual total number of questions included
    type: PricingType; // FREE, PAID, FREE_PREMIUM
    audience: AudienceType;
    createdAt?: string; // ISO timestamp
}

// Interface for Chapterwise Test JSON (inherits BaseGeneratedTest)
export interface ChapterwiseTestJson extends BaseGeneratedTest {
    testType: 'chapterwise'; // Discriminator
    test_subject: [string]; // Array with exactly one subject
    lesson: string;
    examFilter: ExamOption | 'all';
    questions: TestQuestion[]; // Chapterwise tests directly embed questions

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
    test_subject: string[]; // Can have multiple subjects (Physics, Chemistry, Maths/Bio)
    examFilter: ExamOption | 'all';
    weightage?: {
        physics: number;
        chemistry: number;
        maths?: number; // Optional based on stream
        biology?: number; // Optional based on stream
    };
    // Subject-specific question arrays for full length tests
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
  questionId: string; // Or index if using array index for the specific test
  selectedOption: string | null; // e.g., "A", "B", "C", "D", or null if unanswered
  status: QuestionStatus;
  timeTaken?: number; // Optional: time spent on this question
}

export interface TestSession {
  testId: string; // Corresponds to test_code
  userId: string;
  startTime: number; // Timestamp
  endTime?: number; // Timestamp, set on submit
  answers: UserAnswer[]; // Array of user's answers
  // score?: number; // Score might be calculated on results page
}

// For displaying results summary
export interface TestResultSummary {
    testCode: string;
    userId: string;
    user?: UserProfile; // Add user profile for displaying name
    testName: string;
    attemptId: string; // Unique ID for this attempt (e.g., testCode-userId-startTime)
    submittedAt: string; // ISO timestamp
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    score: number;
    percentage: number;
    timeTakenMinutes: number; // Total time taken for the test
    detailedAnswers: Array<{
        questionIndex: number;
        // Question content representation (one of these will be populated)
        questionText?: string | null;
        questionImageUrl?: string | null;
        userAnswer: string | null; // e.g. "A"
        correctAnswer: string; // e.g. "C"
        isCorrect: boolean;
        status: QuestionStatus;
        // Explanation content (one of these might be populated)
        explanationText?: string | null;
        explanationImageUrl?: string | null;
    }>;
}

