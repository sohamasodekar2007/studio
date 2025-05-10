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
export interface UserReferralStats {
  referred_free: number;
  referred_chapterwise: number;
  referred_full_length: number;
  referred_combo: number;
}
export interface UserProfile {
  id: string;
  email: string | null;
  password?: string;
  name: string | null;
  phone: string | null;
  avatarUrl?: string | null;
  class: AcademicStatus | null; // This is the academic status
  model: UserModel;
  role: 'Admin' | 'User';
  expiry_date: string | null;
  createdAt?: string;
  totalPoints?: number;
  targetYear?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  referralCode?: string | null; // Unique referral code for this user
  referredByCode?: string | null; // Referral code this user signed up with
  referralStats?: UserReferralStats; // Stats about users referred by this user
}

// Type for Context User (less sensitive data, includes avatar and points)
export type ContextUser = Omit<UserProfile, 'password'> | null;


// ---- Question Bank Types ----

export const questionTypes = ["image", "text"] as const;
export type QuestionType = typeof questionTypes[number];

export const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export const pyqShifts = ["S1", "S2", "Single"] as const;
export type PyqShift = typeof pyqShifts[number];


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
    image?: string | null;
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
    image?: string | null;
  };
  marks: number;
  isPyq?: boolean;
  pyqDetails?: {
    exam: ExamOption;
    date: string;
    shift: PyqShift;
  } | null;
  created: string;
  modified: string;
}

// Interface for a single question object within a bulk uploaded JSON
export interface BulkQuestionInput {
  questionText?: string;
  questionImageFilename?: string; // Filename like "diagram.png"
  options: { A: string; B: string; C: string; D: string } | [string, string, string, string];
  correctAnswer: "A" | "B" | "C" | "D";
  explanationText?: string;
  explanationImageFilename?: string; // Filename
  marks: number;
  difficulty?: DifficultyLevel;
  tags?: string[];
  classLevel?: ClassLevel; // Use ClassLevel to match QuestionBankItem
  // PYQ details specific to this question in the bulk file
  isPyq?: boolean;
  pyqExam?: ExamOption;
  pyqDate?: string; // YYYY-MM-DD format
  pyqShift?: PyqShift;
}


// ---- Generated Test Definition Types ----

// Reusing Academic Status for Audience
export type AudienceType = AcademicStatus;


// Define Test Streams
export const testStreams = ["PCM", "PCB"] as const;
export type TestStream = typeof testStreams[number];


// Interface for individual question within a generated test JSON
export interface TestQuestion {
    id?: string; // Question ID from the question bank
    type?: QuestionType; // text or image
    question_text?: string | null; // For text questions
    question_image_url?: string | null; // For image questions (full public path)
    options: (string | null)[]; // Array of 4 options, e.g., ["Option A text", "Option B text", ...]
    answer: string; // Correct option key, e.g., "A", "B"
    marks: number;
    explanation_text?: string | null;
    explanation_image_url?: string | null; // Full public path to explanation image
    // Legacy fields for compatibility, prefer specific ones above
    explanation?: string | null; // Could be text or image path in older data
    question?: string | null; // Could be text or image path in older data
}


// Base interface for common generated test properties
interface BaseGeneratedTest {
    testseriesType: 'chapterwise' | 'full_length'; // Renamed from testType
    test_code: string;
    name: string;
    duration: number;
    total_questions: number;
    type: PricingType; // FREE, PAID, FREE_PREMIUM
    audience: AudienceType | null; // e.g., "11th Class", "12th Class", "Dropper"
    createdAt?: string; // ISO date string
    test_subject: string[]; // Array of subjects covered, e.g., ["Physics", "Chemistry"]
}

// Interface for Chapterwise Test JSON (inherits BaseGeneratedTest)
export interface ChapterwiseTestJson extends BaseGeneratedTest {
    testseriesType: 'chapterwise'; // Renamed from testType
    lessons: string[]; // Can now include multiple lessons for combined chapterwise tests
    examFilter?: ExamOption | 'all'; // Optional filter for questions
    questions: TestQuestion[]; // Array of actual question objects for the test

    // Ensure fields specific to FullLengthTestJson are explicitly undefined or not present
    stream?: undefined;
    weightage?: undefined;
    physics_questions?: undefined;
    chemistry_questions?: undefined;
    maths_questions?: undefined;
    biology_questions?: undefined;
    lesson?: string; // Keep 'lesson' for single-lesson tests for backward compatibility or specific use, 'lessons' for multi
}

// Interface for Full Length Test JSON (inherits BaseGeneratedTest)
export interface FullLengthTestJson extends BaseGeneratedTest {
    testseriesType: 'full_length'; // Renamed from testType
    stream: TestStream; // PCM or PCB
    examTypeTarget: ExamOption; // The specific exam this full-length test targets (e.g., MHT-CET, JEE Main)
    
    // Subject-specific question arrays, containing full TestQuestion objects
    physics_questions?: TestQuestion[];
    chemistry_questions?: TestQuestion[];
    maths_questions?: TestQuestion[]; // For PCM
    biology_questions?: TestQuestion[]; // For PCB
    
    weightage?: {
        [subject: string]: number | { [lesson: string]: number }; 
    };

    questions?: undefined;
    lessons?: undefined;
    lesson?: undefined;
    examFilter?: undefined; 
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
  questionId: string;
  selectedOption: string | null;
  status: QuestionStatus;
  timeTaken?: number;
}

// Data structure for the actual test taking session BEFORE saving the report
export interface TestSession {
  testId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  answers: UserAnswer[];
}

// Detailed answer structure stored within the test report
export interface DetailedAnswer {
  questionId: string;
  questionIndex: number;
  questionText?: string | null;
  questionImageUrl?: string | null; // Full public path
  options?: (string | null)[];
  userAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  status: QuestionStatus;
  explanationText?: string | null;
  explanationImageUrl?: string | null; // Full public path
  marks?: number;
}

// Structure for storing test results summary in JSON report file
export interface TestResultSummary {
    testCode: string;
    userId: string;
    testName: string;
    attemptTimestamp: number;
    submittedAt: number;
    duration: number; // Test's configured duration
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    score: number;
    totalMarks: number;
    percentage: number;
    timeTakenMinutes: number; // Actual time taken by user
    pointsEarned?: number;
    detailedAnswers: DetailedAnswer[];
    user?: Omit<UserProfile, 'password'> | null; // For leaderboard display
    rank?: number; // For leaderboard display
}



// ---- Short Notes Types ----
export interface ShortNote {
    id: string;
    title: string;
    description: string;
    subject: string;
    examType: ExamOption;
    contentType: 'pdf' | 'html_php'; // Adjusted contentType
    filePath: string; // Relative path from the respective content directory
    createdAt: string; // ISO date string
    modifiedAt: string; // ISO date string
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
  timestamp: number;
  selectedOption: string | null;
  isCorrect: boolean;
}

// Structure for storing a user's progress on a specific DPP lesson
export interface UserDppLessonProgress {
  userId: string;
  subject: string;
  lesson: string;
  lastAccessed?: number;
  // Key is questionId, value is an array of attempts (latest first)
  questionAttempts: Record<string, DppAttempt[]>;
}

// ---- Notebook / Bookmark Types ----

// Interface for a single Notebook created by the user
export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
}

// Interface for a bookmarked question within a notebook
export interface BookmarkedQuestion {
  questionId: string; // ID of the question from question_bank
  subject: string;    // Subject of the question
  lesson: string;     // Lesson of the question
  addedAt: number;    // Timestamp when bookmarked
  tags?: BookmarkTag[]; // Optional tags
}

// Interface for the user's entire notebook data structure
export interface UserNotebookData {
  userId: string;
  notebooks: Notebook[];
  // Key is notebookId, value is an array of bookmarked questions
  bookmarkedQuestions: Record<string, BookmarkedQuestion[]>;
}

// Default tags for bookmarking
export const bookmarkTags = ["Easy", "Hard", "Tricky", "Do Again", "Important"] as const;
export type BookmarkTag = typeof bookmarkTags[number];


// ---- User Follows Types ----
export interface UserFollows {
  userId: string;
  following: string[]; // Array of user IDs the current user is following
  followers: string[]; // Array of user IDs following the current user
}

// ---- Challenge Test Types ----
export type ChallengeStatus = "pending" | "accepted" | "rejected" | "completed" | "expired";

export interface ChallengeParticipant {
  userId: string;
  name: string | null;
  avatarUrl?: string | null; // Path relative to public/avatars
  status: ChallengeStatus;
  score?: number;
  timeTaken?: number; // in seconds
  rank?: number;
  answers?: UserAnswer[];
}

export interface ChallengeTestConfig {
  subject: string;
  lesson: string; // For now, challenges are based on a single lesson
  numQuestions: number;
  difficulty?: DifficultyLevel | 'all'; // 'all' means mix of difficulties
  examFilter?: ExamOption | 'all'; // Filter questions by exam tag
}

export interface Challenge {
  challengeCode: string;
  creatorId: string;
  creatorName: string | null;
  participants: Record<string, ChallengeParticipant>; // Keyed by userId
  testConfig: ChallengeTestConfig;
  testStatus: "waiting" | "started" | "completed" | "expired";
  questions: TestQuestion[]; // Actual questions for the challenge
  createdAt: number; // Timestamp of creation
  expiresAt: number; // Timestamp of expiry (e.g., creation + 3 hours)
  startedAt?: number; // Timestamp when creator starts the test
}

// For notifications/invites list
export interface ChallengeInvite {
  challengeCode: string;
  creatorId: string;
  creatorName: string | null;
  testName: string; // e.g., "Physics - Motion Challenge"
  numQuestions: number;
  status: "pending" | "accepted" | "rejected" | "expired"; // Status from perspective of the invited user
  createdAt: number;
  expiresAt: number;
}

// Structure for storing challenge invites for a user
export interface UserChallengeInvites {
    userId: string;
    invites: ChallengeInvite[];
}

// Structure for storing a user's completed challenge attempts (for their history)
export interface UserChallengeHistoryItem {
  challengeCode: string;
  testName: string;
  creatorName: string | null;
  opponentNames: (string | null)[]; // Names of other participants
  userScore: number;
  totalPossibleScore: number;
  rank?: number; // User's rank in that specific challenge
  totalParticipants: number;
  completedAt: number; // Timestamp when the user completed/submitted
}
export interface UserChallengeHistory {
    userId: string;
    completedChallenges: UserChallengeHistoryItem[];
}

// ---- Notification Types (Basic for now) ----
export interface AppNotification {
    id: string;
    type: 'challenge_invite' | 'general_update' | 'test_result' | 'referral_used'; // Added referral_used
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: number; // Timestamp
    icon?: React.ElementType; // Optional icon component
}

// ---- Platform Settings Type ----
export interface PlatformSettings {
  maintenanceModeEnabled: boolean;
  newRegistrationsOpen: boolean;
  defaultTestAccess: PricingType;
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  // Payment Gateway Settings
  paymentGatewayEnabled?: boolean; // Made optional as it might not always be present
  stripeApiKey?: string | null;
  razorpayApiKey?: string | null;
  instamojoApiKey?: string | null;
  // Add other platform-wide settings here
}

// ---- Telegram Auth Types ----
export interface TelegramAuthData {
    id: number; // Telegram user ID
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string; // Unix timestamp string
    hash: string; // Verification hash
    phone?: string; // If requested and granted
}
