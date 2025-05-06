// src/types/index.ts

// Define academic statuses used in signup
export const academicStatuses = ["11th Class", "12th Class", "Dropper"] as const;
export type AcademicStatus = typeof academicStatuses[number]; // Renamed to 'ClassType' below for clarity in UserProfile

// Define user models
export const userModels = ["free", "chapterwise", "full_length", "combo"] as const;
export type UserModel = typeof userModels[number];

// Define Test Model types
export const testModels = ["chapterwise", "full_length", "topicwise", "combo", "DPP"] as const; // Added DPP
export type TestModel = typeof testModels[number];

// Define Pricing types
export const pricingTypes = ["free", "paid", "FREE_PREMIUM"] as const; // Added FREE_PREMIUM
export type PricingType = typeof pricingTypes[number];

// Define Test status types (optional, for badges etc.)
export const testStatuses = ["New", "Popular", ""] as const;
export type TestStatus = typeof testStatuses[number];

// Define Exam types
export const exams = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"] as const;
export type Exam = typeof exams[number];


// Interface for User Data (matching the example structure)
// Updated to align with the provided example structure
export interface UserProfile {
  id: string | number; // Allow number based on example
  email: string | null;
  password?: string; // Stored in JSON as per example, but NOT used for auth in this simulation
  name: string | null;
  phone: string | null;
  referral?: string; // Optional referral code
  class: AcademicStatus | null; // Academic status (e.g., 11th, 12th, Dropper)
  model: UserModel; // User's subscription model
  expiry_date: string | null; // ISO string date or null
  createdAt?: string; // Optional: Keep creation date if desired
}

// Interface for Test Data (potentially stored in Firestore or tests.json)
// This represents the data *about* a test series entry shown in lists/details
export interface Test {
  id: string; // document ID
  title: string;
  description?: string;
  type: string; // e.g., Mock Test, Chapter Test, DPP
  exam: Exam; // MHT-CET, JEE Main, etc.
  subject: string; // Physics, PCM, Biology
  model: TestModel; // chapterwise, full_length, etc.
  pricing: PricingType; // free, paid, FREE_PREMIUM
  status?: TestStatus; // New, Popular
  questionsCount: number;
  durationMinutes: number;
  syllabus: string[]; // Array of topics/chapters
  imageUrl?: string; // Optional image URL for detail page
  imageHint?: string; // For AI image generation hints
  published: boolean; // Is the test live?
  createdAt: Date | string; // Timestamp or ISO string
  updatedAt?: Date | string; // Timestamp or ISO string
}

// ---- Question Bank Types ----

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
  id: string; // Unique ID, e.g., Q_{timestamp}
  subject: string;
  lesson: string;
  class: ClassLevel;
  examType: ExamOption; // Renamed from exam to avoid conflict with Exam type above
  difficulty: DifficultyLevel;
  tags: string[];
  type: QuestionType; // 'image' or 'text'
  question: {
    text?: string | null; // Text for text questions, null/optional for image
    image?: string | null; // Filename like Q_{timestamp}_{hash}.ext for image questions
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
    image?: string | null; // Filename like E_{timestamp}_{hash}.ext
  };
  created: string; // ISO timestamp
  modified: string; // ISO timestamp
  // Optional fields for future enhancements
  version?: number;
  changeHistory?: { timestamp: string; changes: string }[];
}


// ---- Generated Test Definition Types ----

// Interface for Chapterwise Test JSON structure (saved in test_pages/chapterwise)
export interface ChapterwiseTestJson {
  test_id: string; // e.g., phy_thermodynamics_jee_20240520
  title: string; // Auto-generated or user-defined
  subject: string;
  lesson: string;
  examFilter: ExamOption | 'Random Exam';
  questions: string[]; // Array of QuestionBankItem IDs (e.g., "Q_1681234567890")
  duration: number; // in minutes
  access: PricingType;
  audience: AcademicStatus;
  type: 'chapterwise';
  createdAt: string; // ISO timestamp
}

// Interface for Full-Length Test JSON structure (saved in test_pages/full_length)
export interface FullLengthTestJson {
  test_id: string; // e.g., pcm_neet_20240520
  title: string; // Auto-generated or user-defined
  stream: 'PCM' | 'PCB'; // Add 'Commerce' if needed later
  examFilter: ExamOption | 'Combined';
  // Store question IDs grouped by subject
  physics: string[];
  chemistry: string[];
  maths?: string[]; // Optional based on stream
  biology?: string[]; // Optional based on stream
  weightage: { [subject: string]: number }; // e.g., {"physics": 40, "chemistry": 30, "maths": 30}
  duration: number; // in minutes
  access: PricingType;
  audience: AcademicStatus;
  type: 'full_length';
  createdAt: string; // ISO timestamp
}

// General Test Definition (useful for listing generated tests, maybe?)
export type GeneratedTestDefinition = ChapterwiseTestJson | FullLengthTestJson;
