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
interface TestQuestion {
    question: string; // Text or image filename
    image_url?: string | null; // URL if image question
    options: string[]; // Array of 4 strings ["Option A: ...", "Option B: ...", ...]
    answer: string; // Correct answer text ("OPTION A", "OPTION B", etc.)
    marks: number;
    explanation?: string | null; // Text or image path/URL
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

// Interface for Chapterwise Test JSON
export interface ChapterwiseTestJson extends BaseGeneratedTest {
    test_subject: [string]; // Array with exactly one subject
    lesson: string;
    examFilter: ExamOption | 'all'; // Added exam filter
    questions: TestQuestion[]; // Direct array of questions for the single subject
}

// Interface for Full Length Test JSON
export interface FullLengthTestJson extends BaseGeneratedTest {
    stream: TestStream;
    test_subject: string[]; // Can have multiple subjects (Physics, Chemistry, Maths/Bio)
    examFilter: ExamOption | 'all'; // Added exam filter
    weightage?: {
        physics: number;
        chemistry: number;
        maths?: number;
        biology?: number;
    };
    physics?: TestQuestion[];
    chemistry?: TestQuestion[];
    maths?: TestQuestion[];
    biology?: TestQuestion[];
}

// General type covering both generated test structures
export type GeneratedTest = ChapterwiseTestJson | FullLengthTestJson;
