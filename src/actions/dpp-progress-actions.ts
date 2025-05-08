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

  // Use the helper function to get the correct path including userId
  const filePath = getProgressFilePath(userId, subject, lesson);

  try {
    await fs.access(filePath); // Check if file exists
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const progressData: UserDppLessonProgress = JSON.parse(fileContent);
    return progressData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, which is normal for first attempt
      return null;
    }
    console.error(`Error reading DPP progress file ${filePath}:`, error);
    // Return null or throw depending on how critical this is
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
  const dirPath = path.dirname(filePath); // Get directory path for ensureDirExists

  let pointsAwarded = 0; // Track points for this attempt

  try {
    // Ensure directory exists
    await ensureDirExists(dirPath);

    // Read existing progress or initialize new object
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
        progressData.lastAccessed = Date.now(); // Update last accessed time
    }

    // Check if this question has been answered correctly before in this lesson
    const previousAttempts = progressData.questionAttempts[questionId] || [];
    const previouslyCorrect = previousAttempts.some(attempt => attempt.isCorrect);

    // Award points only if it wasn't answered correctly before
    if (!previouslyCorrect) {
      pointsAwarded = isCorrect ? POINTS_FOR_CORRECT_DPP : POINTS_FOR_INCORRECT_DPP;
    } else if (previouslyCorrect && !isCorrect) {
        // Optional: Penalize if user changes a correct answer to incorrect?
        // pointsAwarded = POINTS_FOR_INCORRECT_DPP;
    } else {
        // No points awarded if already correct, or changing from incorrect to incorrect.
        pointsAwarded = 0;
    }

    // Initialize attempts array for the question if it doesn't exist
    if (!progressData.questionAttempts[questionId]) {
      progressData.questionAttempts[questionId] = [];
    }

    // Create the new attempt object
    const newAttempt: DppAttempt = {
      timestamp: Date.now(),
      selectedOption,
      isCorrect,
    };

    // Add the new attempt to the beginning of the array for that question
    progressData.questionAttempts[questionId].unshift(newAttempt);

    // Write the updated progress data back to the file
    await fs.writeFile(filePath, JSON.stringify(progressData, null, 2), 'utf-8');
    console.log(`DPP attempt saved for user ${userId}, lesson ${lesson}, question ${questionId}`);

    // Update total user points if points were awarded/deducted
    if (pointsAwarded !== 0) {
         try {
             await updateUserPoints(userId, pointsAwarded);
         } catch (pointsError: any) {
             console.error(`Failed to update points for user ${userId} after DPP attempt:`, pointsError);
             // Decide how to handle: Log, return partial success? Returning success for the attempt save.
         }
     }

    return { success: true };

  } catch (error: any) {
    console.error(`Error saving DPP attempt to ${filePath}:`, error);
    return { success: false, message: `Failed to save DPP attempt. Reason: ${error.message}` };
  }
}
