// src/actions/dpp-progress-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserDppLessonProgress, DppAttempt } from '@/types';
import { updateUserPoints } from './points-actions'; // Import the points action

const dppProgressBasePath = path.join(process.cwd(), 'src', 'data', 'user-dpp-progress');

// --- Point System Constants ---
const POINTS_FOR_CORRECT_DPP = 2;
const POINTS_FOR_INCORRECT_DPP = -1; // Example: Deduct points for incorrect

/**
 * Helper function to ensure directory exists, creating it recursively if necessary.
 * @param dirPath The path of the directory to ensure exists.
 */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error; // Re-throw if error is not "directory already exists"
    }
  }
}

/**
 * Constructs the file path for a specific DPP progress file.
 * Includes userId in the path structure.
 */
function getProgressFilePath(userId: string, subject: string, lesson: string): string {
    const userDir = path.join(dppProgressBasePath, userId);
    const subjectDir = path.join(userDir, subject);
    return path.join(subjectDir, `${lesson}.json`);
}


/**
 * Retrieves the DPP progress data for a specific user, subject, and lesson.
 * Returns null if no progress file exists.
 * @param userId The ID of the user.
 * @param subject The subject name.
 * @param lesson The lesson name.
 * @returns A promise resolving to the UserDppLessonProgress object or null.
 */
export async function getDppProgress(
  userId: string,
  subject: string,
  lesson: string
): Promise<UserDppLessonProgress | null> {
  if (!userId || !subject || !lesson) {
    console.warn("getDppProgress: Missing required parameters.");
    return null;
  }

  const filePath = getProgressFilePath(userId, subject, lesson);

  try {
    await fs.access(filePath); 
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const progressData: UserDppLessonProgress = JSON.parse(fileContent);
    return progressData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error(`Error reading DPP progress file ${filePath}:`, error);
    return null;
  }
}

/**
 * Saves a single DPP attempt for a user. Creates or updates the progress file.
 * Awards points based on correctness.
 * @param userId The ID of the user.
 * @param subject The subject name.
 * @param lesson The lesson name.
 * @param questionId The ID of the question attempted.
 * @param selectedOption The option selected by the user (e.g., "A", "B") or null.
 * @param isCorrect Whether the selected option was correct.
 * @returns A promise resolving with success status and optional message.
 */
export async function saveDppAttempt(
  userId: string,
  subject: string,
  lesson: string,
  questionId: string,
  selectedOption: string | null,
  isCorrect: boolean
): Promise<{ success: boolean; message?: string }> {
  if (!userId || !subject || !lesson || !questionId) {
    return { success: false, message: 'Missing required parameters for saving DPP attempt.' };
  }

  const filePath = getProgressFilePath(userId, subject, lesson);
  const dirPath = path.dirname(filePath); 

  let pointsAwarded = 0; 

  try {
    await ensureDirExists(dirPath);

    let progressData: UserDppLessonProgress | null = await getDppProgress(userId, subject, lesson);

    if (!progressData) {
      progressData = {
        userId,
        subject,
        lesson,
        lastAccessed: Date.now(),
        questionAttempts: {},
      };
    } else {
        progressData.lastAccessed = Date.now(); 
    }

    const previousAttempts = progressData.questionAttempts[questionId] || [];
    const previouslyCorrect = previousAttempts.some(attempt => attempt.isCorrect);

    if (!previouslyCorrect) {
      pointsAwarded = isCorrect ? POINTS_FOR_CORRECT_DPP : POINTS_FOR_INCORRECT_DPP;
    } else if (previouslyCorrect && !isCorrect) {
        // pointsAwarded = POINTS_FOR_INCORRECT_DPP;
    } else {
        pointsAwarded = 0;
    }

    if (!progressData.questionAttempts[questionId]) {
      progressData.questionAttempts[questionId] = [];
    }

    const newAttempt: DppAttempt = {
      timestamp: Date.now(),
      selectedOption,
      isCorrect,
    };

    progressData.questionAttempts[questionId].unshift(newAttempt);

    await fs.writeFile(filePath, JSON.stringify(progressData, null, 2), 'utf-8');
    console.log(`DPP attempt saved for user ${userId}, lesson ${lesson}, question ${questionId}`);

    if (pointsAwarded !== 0) {
         try {
             await updateUserPoints(userId, pointsAwarded);
         } catch (pointsError: any) {
             console.error(`Failed to update points for user ${userId} after DPP attempt:`, pointsError);
         }
     }

    return { success: true };

  } catch (error: any) {
    console.error(`Error saving DPP attempt to ${filePath}:`, error);
    return { success: false, message: `Failed to save DPP attempt. Reason: ${error.message}` };
  }
}


/**
 * Retrieves all DPP progress for a user within a specific date range.
 * This involves reading all subject and lesson progress files for the user
 * and filtering attempts by timestamp.
 * @param userId The ID of the user.
 * @param startDateISO The start date of the range (ISO string).
 * @param endDateISO The end date of the range (ISO string).
 * @returns A promise resolving to an array of UserDppLessonProgress objects,
 *          where each object only contains attempts within the specified date range.
 */
export async function getDppProgressForDateRange(
  userId: string,
  startDateISO: string,
  endDateISO: string
): Promise<UserDppLessonProgress[]> {
  if (!userId || !startDateISO || !endDateISO) {
    console.warn("getDppProgressForDateRange: Missing required parameters.");
    return [];
  }

  const startDate = new Date(startDateISO).getTime();
  const endDate = new Date(endDateISO).getTime();
  const userDirPath = path.join(dppProgressBasePath, userId);
  const results: UserDppLessonProgress[] = [];

  try {
    await ensureDirExists(userDirPath);
    const subjectDirs = await fs.readdir(userDirPath, { withFileTypes: true });

    for (const subjectDir of subjectDirs) {
      if (subjectDir.isDirectory()) {
        const subjectName = subjectDir.name;
        const subjectPath = path.join(userDirPath, subjectName);
        const lessonFiles = await fs.readdir(subjectPath, { withFileTypes: true });

        for (const lessonFile of lessonFiles) {
          if (lessonFile.isFile() && lessonFile.name.endsWith('.json')) {
            const lessonName = lessonFile.name.replace('.json', '');
            const lessonProgress = await getDppProgress(userId, subjectName, lessonName);

            if (lessonProgress) {
              const filteredAttempts: Record<string, DppAttempt[]> = {};
              let hasAttemptsInRange = false;

              for (const questionId in lessonProgress.questionAttempts) {
                const attempts = lessonProgress.questionAttempts[questionId];
                const attemptsInRange = attempts.filter(attempt => 
                  attempt.timestamp >= startDate && attempt.timestamp <= endDate
                );
                if (attemptsInRange.length > 0) {
                  filteredAttempts[questionId] = attemptsInRange;
                  hasAttemptsInRange = true;
                }
              }

              if (hasAttemptsInRange) {
                results.push({
                  ...lessonProgress,
                  questionAttempts: filteredAttempts,
                });
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT' && error.path === userDirPath) {
      // User has no DPP data yet, which is fine.
      return [];
    }
    console.error(`Error reading DPP progress for user ${userId} in date range:`, error);
  }
  return results;
}

