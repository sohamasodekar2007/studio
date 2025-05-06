
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

// Interface for individual question within a generated test JSON
interface TestQuestion {
    question: string; // Text or image filename
    image_url?: string | null; // URL if image question
    options: string[]; // Array of 4 strings ["Option A", "Option B", ...]
    answer: string; // Correct answer text ("Option A", "Option B", etc.)
    marks: number;
    explanation?: string | null; // Text or image path/URL
}

// Interface for the main generated test JSON structure (stored in tests_json)
export interface GeneratedTest {
  test_code: string; // Unique 8-10 digit randomized code
  name: string; // User-defined test name
  duration: number; // in minutes
  count: number; // Number of questions selected (1-20)
  total_questions: number; // Actual total number of questions included (might differ from count if limited by bank)
  test_subject: string[]; // Array of subjects covered (e.g., ["physics", "chemistry"])
  type: PricingType; // FREE, PAID, FREE_PREMIUM
  // Questions organized by subject
  physics?: TestQuestion[];
  chemistry?: TestQuestion[];
  maths?: TestQuestion[];
  biology?: TestQuestion[];
  // Optional metadata
  createdAt?: string; // ISO timestamp when the test was generated
}


// --- Old Test Type (Obsolete - Kept for reference/migration if needed) ---
/*
export const testModelsOld = ["chapterwise", "full_length", "topicwise", "combo", "DPP"] as const;
export type TestModelOld = typeof testModelsOld[number];

export const testStatuses = ["New", "Popular", ""] as const;
export type TestStatus = typeof testStatuses[number];

export interface Test {
  id: string;
  title: string;
  description?: string;
  type: string;
  exam: Exam;
  subject: string;
  model: TestModelOld;
  pricing: PricingType; // Re-use pricing type
  status?: TestStatus;
  questionsCount: number;
  durationMinutes: number;
  syllabus: string[];
  imageUrl?: string;
  imageHint?: string;
  published: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}
*/
