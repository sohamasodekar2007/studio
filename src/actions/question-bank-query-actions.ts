// src/actions/question-bank-query-actions.ts
'use server';

import type { QuestionBankItem, ClassLevel, ExamOption } from '@/types';
import fs from 'fs/promises';
import path from 'path';

const questionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');

/**
 * Retrieves a list of available subjects by reading directory names.
 * @returns A promise resolving to an array of subject names.
 */
export async function getSubjects(): Promise<string[]> {
  try {
    const entries = await fs.readdir(questionBankBasePath, { withFileTypes: true });
    const subjects = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.')) // Filter out non-directories and hidden files
      .map(entry => entry.name);
    return subjects;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`Question bank base path not found: ${questionBankBasePath}. Returning empty array.`);
      // Attempt to create the base directory if it doesn't exist
      try {
        await fs.mkdir(questionBankBasePath, { recursive: true });
        console.log(`Created question bank base directory: ${questionBankBasePath}`);
        return []; // Return empty array after creating
      } catch (mkdirError) {
        console.error(`Failed to create question bank base directory: ${questionBankBasePath}`, mkdirError);
        throw new Error('Failed to access or create question bank storage.');
      }
    }
    console.error('Error reading subjects:', error);
    throw new Error('Failed to retrieve subjects.'); // Re-throw a user-friendly error
  }
}


/**
 * Retrieves a list of lessons for a given subject by reading directory names.
 * @param subject The name of the subject.
 * @returns A promise resolving to an array of lesson names for the subject.
 */
export async function getLessonsForSubject(subject: string): Promise<string[]> {
  if (!subject) return [];
  const subjectPath = path.join(questionBankBasePath, subject);
  try {
    const entries = await fs.readdir(subjectPath, { withFileTypes: true });
    const lessons = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'images') // Filter for lesson directories, exclude 'images'
      .map(entry => entry.name);
    return lessons;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
       console.warn(`Lessons path not found for subject ${subject}: ${subjectPath}. Returning empty array.`);
       return []; // Subject directory doesn't exist or no lesson folders yet
    }
    console.error(`Error reading lessons for subject ${subject}:`, error);
    throw new Error(`Failed to retrieve lessons for ${subject}.`);
  }
}

interface QuestionFilters {
    subject: string;
    lesson: string;
    class?: ClassLevel;
    examType?: ExamOption;
    // Add other potential filters like difficulty, tags etc.
}

/**
 * Retrieves questions based on provided filters (subject, lesson, optional class, examType).
 * Reads JSON files from the corresponding questions directory.
 * @param filters An object containing filter criteria.
 * @returns A promise resolving to an array of QuestionBankItem matching the filters.
 */
export async function getQuestionsForLesson(filters: QuestionFilters): Promise<QuestionBankItem[]> {
  const { subject, lesson, class: classFilter, examType: examFilter } = filters;
  if (!subject || !lesson) {
    console.warn("Subject and Lesson are required to fetch questions.");
    return [];
  }

  const questionsDir = path.join(questionBankBasePath, subject, lesson, 'questions');
  let allQuestions: QuestionBankItem[] = [];

  try {
    // Ensure the questions directory exists before trying to read it
    try {
        await fs.access(questionsDir);
    } catch (accessError: any) {
        if (accessError.code === 'ENOENT') {
             console.warn(`Questions directory not found: ${questionsDir}. Returning empty array.`);
             return []; // Questions directory doesn't exist for this lesson
        }
        throw accessError; // Re-throw other access errors
    }


    const files = await fs.readdir(questionsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));

    for (const file of jsonFiles) {
      const filePath = path.join(questionsDir, file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const questionData = JSON.parse(fileContent) as QuestionBankItem;
        // Basic validation to ensure core fields exist (adjust as needed)
        if (questionData.id && questionData.subject && questionData.lesson) {
             allQuestions.push(questionData);
        } else {
            console.warn(`Skipping invalid question file (missing core fields): ${filePath}`);
        }

      } catch (parseError) {
        console.error(`Error parsing question file ${filePath}:`, parseError);
        // Optionally skip this file or handle the error differently
      }
    }

    // Apply filters
    const filteredQuestions = allQuestions.filter(q => {
        let matches = true;
        if (classFilter && q.class !== classFilter) {
            matches = false;
        }
        if (examFilter && q.examType !== examFilter) {
             matches = false;
        }
        // Add more filter logic here if needed (e.g., for tags, difficulty)
        return matches;
    });

    return filteredQuestions;

  } catch (error: any) {
     if (error.code === 'ENOENT') {
        // This case should be handled by the access check above, but kept as fallback
       console.warn(`Questions directory not found: ${questionsDir}. Returning empty array.`);
       return []; // Questions directory doesn't exist
     }
     console.error(`Error reading questions for ${subject}/${lesson}:`, error);
     throw new Error(`Failed to retrieve questions for ${subject}/${lesson}.`);
  }
}


/**
 * Deletes a specific question JSON file and associated images.
 * @param params Object containing questionId, subject, and lesson.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteQuestion(params: { questionId: string; subject: string; lesson: string }): Promise<{ success: boolean; message?: string }> {
  const { questionId, subject, lesson } = params;
  if (!questionId || !subject || !lesson) {
    return { success: false, message: 'Missing required parameters for deletion.' };
  }

  const questionFilePath = path.join(questionBankBasePath, subject, lesson, 'questions', `${questionId}.json`);
  const imagesDir = path.join(questionBankBasePath, subject, lesson, 'images');

  try {
    // 1. Read the question JSON to find associated images (optional but safer)
    let questionImage: string | null = null;
    let explanationImage: string | null = null;
    try {
        const fileContent = await fs.readFile(questionFilePath, 'utf-8');
        const questionData = JSON.parse(fileContent) as QuestionBankItem;
        questionImage = questionData.question.image;
        explanationImage = questionData.explanation.image;
    } catch (readError: any) {
         if (readError.code === 'ENOENT') {
              return { success: false, message: `Question file not found: ${questionId}` };
         }
        console.warn(`Could not read question file ${questionId} to find images, attempting deletion anyway.`);
        // Proceed without image info if read fails but file likely exists
    }


    // 2. Delete the question JSON file
    await fs.unlink(questionFilePath);
    console.log(`Deleted question JSON: ${questionFilePath}`);

    // 3. Delete associated images
    if (questionImage) {
      try {
        await fs.unlink(path.join(imagesDir, questionImage));
        console.log(`Deleted question image: ${questionImage}`);
      } catch (imgError: any) {
        if (imgError.code !== 'ENOENT') console.error(`Error deleting question image ${questionImage}:`, imgError);
        else console.warn(`Question image ${questionImage} not found, skipping.`);
      }
    }
    if (explanationImage) {
      try {
        await fs.unlink(path.join(imagesDir, explanationImage));
         console.log(`Deleted explanation image: ${explanationImage}`);
      } catch (imgError: any) {
        if (imgError.code !== 'ENOENT') console.error(`Error deleting explanation image ${explanationImage}:`, imgError);
         else console.warn(`Explanation image ${explanationImage} not found, skipping.`);
      }
    }

     // TODO: Update Master Index if one exists

    return { success: true };

  } catch (error: any) {
    console.error(`Error deleting question ${questionId}:`, error);
    // Check if the error was because the file didn't exist initially
    if (error.code === 'ENOENT') {
        return { success: false, message: `Question ${questionId} not found.` };
    }
    return { success: false, message: `Failed to delete question ${questionId}. Reason: ${error.message}` };
  }
}

// --- TODO: Implement updateQuestion Action ---
// export async function updateQuestion(...) { ... }
