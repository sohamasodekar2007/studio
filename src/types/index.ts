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
export const pricingTypes = ["free", "paid"] as const;
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
export interface Test {
  id: string; // document ID
  title: string;
  description?: string;
  type: string; // e.g., Mock Test, Chapter Test, DPP
  exam: Exam; // MHT-CET, JEE Main, etc.
  subject: string; // Physics, PCM, Biology
  model: TestModel; // chapterwise, full_length, etc.
  pricing: PricingType; // free, paid
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
