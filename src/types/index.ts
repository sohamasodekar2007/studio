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
export const exams = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"] as const;
export type Exam = typeof exams[number];


// Interface for User Data (Stored in users.json)
export interface UserProfile {
  id: string | number; // Use randomized 10-digit number or string
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

// ---- Question Bank Types (Remain largely the same) ----

export const questionTypes = ["image", "text"] as const;
export type QuestionType = typeof questionTypes[number];

export const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export const examOptions = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET", "Other"] as const;
export type ExamOption = typeof examOptions[number]; // Used in Question Bank

export const classLevels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type ClassLevel = typeof classLevels[number];

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
export const audienceTypes = academicStatuses;
export type AudienceType = AcademicStatus;

// Define Test Streams
export const testStreams = ["PCM", "PCB"] as const;
export type TestStream = typeof testStreams[number];

// Interface for individual question within a generated test JSON
export interface TestQuestion {
    question: string; // Text or image filename
    image_url?: string | null; // URL if image question
    options: string[]; // Array of 4 strings ["Option A: ...", "Option B: ...", ...]
    answer: string; // Correct answer text ("Option A", "Option B", etc.) // This should represent the correct option key like "A", "B"
    marks: number;
    explanation?: string | null; // Text or image path/URL
    // Fields from QuestionBankItem that might be useful for display or logic in test
    id?: string; // Original question ID from bank
    type?: QuestionType; // 'text' or 'image'
    originalOptions?: { A: string; B: string; C: string; D: string }; // Store original options structure if needed
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
    // Common field for the test questions
    questions?: TestQuestion[]; // Array of questions, structure might vary slightly or be standardized
}

// Interface for Chapterwise Test JSON (inherits BaseGeneratedTest)
// Ensure 'testType' is added for discriminated union if needed at schema level
export interface ChapterwiseTestJson extends BaseGeneratedTest {
    testType: 'chapterwise'; // Discriminator
    test_subject: [string]; // Array with exactly one subject
    lesson: string;
    examFilter: ExamOption | 'all';
    // 'questions' field is inherited from BaseGeneratedTest and used here
    physics?: undefined; // Ensure these are not present for chapterwise
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
        maths?: number;
        biology?: number;
    };
    // Subject-specific question arrays for full length tests
    physics?: TestQuestion[];
    chemistry?: TestQuestion[];
    maths?: TestQuestion[];
    biology?: TestQuestion[];
    // 'questions' from BaseGeneratedTest might be undefined or used differently for full length
    lesson?: undefined; // Ensure this is not present for full_length
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
  questionId: string; // Or index if using array index
  selectedOption: string | null; // e.g., "A", "B", "C", "D", or null if unanswered
  status: QuestionStatus;
  timeTaken?: number; // Optional: time spent on this question
}

export interface TestSession {
  testId: string;
  userId: string;
  startTime: number; // Timestamp
  endTime?: number; // Timestamp, set on submit
  answers: UserAnswer[];
  score?: number;
  // Add other relevant session data
}

export interface TestResultSummary {
    testCode: string;
    userId: string;
    userName?: string;
    testName: string;
    attemptId: string; // Unique ID for this attempt
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
        questionIndex: number; // or questionId
        questionTextOrImage: string; // A representation of the question
        userAnswer: string | null; // e.g. "A"
        correctAnswer: string; // e.g. "C"
        isCorrect: boolean;
        status: QuestionStatus; // From UserAnswer
        explanation?: string | null;
    }>;
}
