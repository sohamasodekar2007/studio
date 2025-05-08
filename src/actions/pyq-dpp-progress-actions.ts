// src/actions/pyq-dpp-progress-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserDppLessonProgress, DppAttempt, ExamOption } from '@/types'; // Use existing DPP types
import { updateUserPoints } from './points-actions';

// Define a separate base path for PYQ DPP progress
const pyqDppProgressBasePath = path.join(process.cwd(), 'src', 'data', 'user-pyq-dpp-progress');

// Point system constants can be reused or defined specifically for PYQs
const POINTS_FOR_CORRECT_PYQ_DPP = 3; // Example: Higher points for PYQs
const POINTS_FOR_INCORRECT_PYQ_DPP = -1;

/**
 * Helper function to ensure directory exists.
 */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Constructs the file path for a specific PYQ DPP progress file.
 * Uses examName in the path structure.
 */
function getPyqProgressFilePath(userId: string, examName: string, subject: string, lesson: string): string {
  const userDir = path.join(pyqDppProgressBasePath, userId);
  // Example: Store under userId/examName/subject/lesson.json
  const examDir = path.join(userDir, examName);
  const subjectDir = path.join(examDir, subject);
  return path.join(subjectDir, `${lesson}.json`);

  // Alternative: Flattened filename like userId/examName_subject_lesson.json
  // return path.join(userDir, `${examName}_${subject}_${lesson}.json`);
}

/**
 * Retrieves the PYQ DPP progress data for a specific user, exam, subject, and lesson.
 * Returns null if no progress file exists.
 */
export async function getPyqDppProgress(
  userId: string,
  examName: string,
  subject: string,
  lesson: string
): Promise<UserDppLessonProgress | null> {
  if (!userId || !examName || !subject || !lesson) {
    console.warn("getPyqDppProgress: Missing required parameters.");
    return null;
  }

  const filePath = getPyqProgressFilePath(userId, examName, subject, lesson);

  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const progressData: UserDppLessonProgress = JSON.parse(fileContent);
    return progressData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist, no progress yet
    }
    console.error(`Error reading PYQ DPP progress file ${filePath}:`, error);
    return null;
  }
}

/**
 * Saves a single PYQ DPP attempt for a user. Creates or updates the progress file.
 * Awards points based on correctness (potentially different points for PYQs).
 */
export async function savePyqDppAttempt(
  userId: string,
  examName: string,
  subject: string,
  lesson: string,
  questionId: string,
  selectedOption: string | null,
  isCorrect: boolean
): Promise<{ success: boolean; message?: string }> {
  if (!userId || !examName || !subject || !lesson || !questionId) {
    return { success: false, message: 'Missing required parameters for saving PYQ DPP attempt.' };
  }

  const filePath = getPyqProgressFilePath(userId, examName, subject, lesson);
  const dirPath = path.dirname(filePath); // Get directory path for ensureDirExists

  let pointsAwarded = 0;

  try {
    await ensureDirExists(dirPath); // Ensure the directory structure exists

    let progressData = await getPyqDppProgress(userId, examName, subject, lesson);

    if (!progressData) {
      progressData = { userId, subject, lesson, questionAttempts: {}, lastAccessed: Date.now() };
    } else {
      progressData.lastAccessed = Date.now();
    }

    const previousAttempts = progressData.questionAttempts[questionId] || [];
    const previouslyCorrect = previousAttempts.some(attempt => attempt.isCorrect);

    if (!previouslyCorrect) {
      pointsAwarded = isCorrect ? POINTS_FOR_CORRECT_PYQ_DPP : POINTS_FOR_INCORRECT_PYQ_DPP;
    } else {
      pointsAwarded = 0; // No points if already answered correctly previously
    }

    if (!progressData.questionAttempts[questionId]) {
      progressData.questionAttempts[questionId] = [];
    }

    const newAttempt: DppAttempt = { timestamp: Date.now(), selectedOption, isCorrect };
    progressData.questionAttempts[questionId].unshift(newAttempt); // Add to beginning

    await fs.writeFile(filePath, JSON.stringify(progressData, null, 2), 'utf-8');
    console.log(`PYQ DPP attempt saved for user ${userId}, exam ${examName}, lesson ${lesson}, question ${questionId}`);

    if (pointsAwarded !== 0) {
         try {
             await updateUserPoints(userId, pointsAwarded);
         } catch (pointsError: any) {
             console.error(`Failed to update points for user ${userId} after PYQ DPP attempt:`, pointsError);
         }
     }

    return { success: true };

  } catch (error: any) {
    console.error(`Error saving PYQ DPP attempt to ${filePath}:`, error);
    return { success: false, message: `Failed to save PYQ DPP attempt. Reason: ${error.message}` };
  }
}
