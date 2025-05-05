// src/types/index.ts

// Define academic statuses used in signup
export const academicStatuses = ["11th Class", "12th Class", "Dropper"] as const;
export type AcademicStatus = typeof academicStatuses[number];

// Define Test Model types
export const testModels = ["chapterwise", "full_length", "topicwise", "combo"] as const;
export type TestModel = typeof testModels[number];

// Define Pricing types
export const pricingTypes = ["free", "paid"] as const;
export type PricingType = typeof pricingTypes[number];

// Define Test status types (optional, for badges etc.)
export const testStatuses = ["New", "Popular", ""] as const;
export type TestStatus = typeof testStatuses[number];


// Interface for User Data (potentially stored in Firestore or users.json)
export interface UserProfile {
  uid: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null; // Added phone number
  academicStatus: AcademicStatus | null;
  createdAt: Date | string; // Store as ISO string or Timestamp in Firestore/JSON
  // Add other profile fields as needed (e.g., targetExams)
}

// Interface for Test Data (potentially stored in Firestore)
export interface Test {
  id: string; // Firestore document ID
  title: string;
  description?: string;
  type: string; // e.g., Mock Test, Chapter Test
  exam: string; // MHT-CET, JEE Main, etc.
  subject: string; // Physics, PCM, Biology
  model: TestModel;
  pricing: PricingType;
  status?: TestStatus;
  questionsCount: number;
  durationMinutes: number;
  syllabus: string[]; // Array of topics/chapters
  imageUrl?: string; // Optional image URL
  imageHint?: string; // For AI image generation hints
  published: boolean; // Is the test live?
  createdAt: Date | string; // Firestore Timestamp or ISO string
  updatedAt?: Date | string; // Firestore Timestamp or ISO string
  // Add fields for question IDs array, answer key reference, etc.
}

// You can add more shared types here as the application grows
