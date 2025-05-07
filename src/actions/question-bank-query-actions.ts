// src/actions/question-bank-query-actions.ts
'use server';

import type { QuestionBankItem, ClassLevel, ExamOption } from '@/types';
import fs from 'fs/promises';
import path from 'path';

// Base path for JSON question data files
const jsonQuestionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');
// Base path for publicly served images
const publicImagesBasePath = path.join(process.cwd(), 'public', 'question_bank_images');


/**
 * Retrieves a list of available subjects by reading directory names from the JSON data path.
 * @returns A promise resolving to an array of subject names.
 */
export async function getSubjects(): Promise<string[]> {
  try {
    const entries = await fs.readdir(jsonQuestionBankBasePath, { withFileTypes: true });
    const subjects = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name);
    return subjects;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`Question bank base path for JSON not found: ${jsonQuestionBankBasePath}. Creating it.`);
      try {
        await fs.mkdir(jsonQuestionBankBasePath, { recursive: true });
        // Also ensure the public image base directory exists
        await fs.mkdir(publicImagesBasePath, { recursive: true });
        console.log(`Created base directories: ${jsonQuestionBankBasePath} and ${publicImagesBasePath}`);
        return [];
      } catch (mkdirError) {
        console.error(`Failed to create question bank base directories:`, mkdirError);
        throw new Error('Failed to access or create question bank storage.');
      }
    }
    console.error('Error reading subjects:', error);
    throw new Error('Failed to retrieve subjects.');
  }
}


/**
 * Retrieves a list of lessons for a given subject by reading directory names from the JSON data path.
 * @param subject The name of the subject.
 * @returns A promise resolving to an array of lesson names for the subject.
 */
export async function getLessonsForSubject(subject: string): Promise<string[]> {
  if (!subject) return [];
  const subjectJsonPath = path.join(jsonQuestionBankBasePath, subject);
  try {
    const entries = await fs.readdir(subjectJsonPath, { withFileTypes: true });
    const lessons = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'images') // Exclude 'images' folder which might be in src/data if not careful
      .map(entry => entry.name);
    return lessons;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
       console.warn(`Lessons JSON path not found for subject ${subject}: ${subjectJsonPath}. Returning empty array.`);
       return [];
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
}

/**
 * Retrieves questions based on provided filters from the JSON data path.
 * @param filters An object containing filter criteria.
 * @returns A promise resolving to an array of QuestionBankItem matching the filters.
 */
export async function getQuestionsForLesson(filters: QuestionFilters): Promise<QuestionBankItem[]> {
  const { subject, lesson, class: classFilter, examType: examFilter } = filters;
  if (!subject || !lesson) {
    console.warn("Subject and Lesson are required to fetch questions.");
    return [];
  }

  const questionsJsonDir = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions');
  let allQuestions: QuestionBankItem[] = [];

  try {
    try {
        await fs.access(questionsJsonDir);
    } catch (accessError: any) {
        if (accessError.code === 'ENOENT') {
             console.warn(`Questions JSON directory not found: ${questionsJsonDir}. Returning empty array.`);
             return [];
        }
        throw accessError;
    }

    const files = await fs.readdir(questionsJsonDir);
    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));

    for (const file of jsonFiles) {
      const filePath = path.join(questionsJsonDir, file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const questionData = JSON.parse(fileContent) as QuestionBankItem;
        if (questionData.id && questionData.subject && questionData.lesson) {
             allQuestions.push(questionData);
        } else {
            console.warn(`Skipping invalid question JSON file (missing core fields): ${filePath}`);
        }
      } catch (parseError) {
        console.error(`Error parsing question file ${filePath}:`, parseError);
      }
    }

    const filteredQuestions = allQuestions.filter(q => {
        let matches = true;
        if (classFilter && q.class !== classFilter) matches = false;
        if (examFilter && q.examType !== examFilter) matches = false;
        return matches;
    });

    return filteredQuestions;

  } catch (error: any) {
     if (error.code === 'ENOENT') {
       console.warn(`Questions JSON directory not found: ${questionsJsonDir}. Returning empty array.`);
       return [];
     }
     console.error(`Error reading questions for ${subject}/${lesson}:`, error);
     throw new Error(`Failed to retrieve questions for ${subject}/${lesson}.`);
  }
}


/**
 * Deletes a specific question JSON file and associated images from public directory.
 * @param params Object containing questionId, subject, and lesson.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteQuestion(params: { questionId: string; subject: string; lesson: string }): Promise<{ success: boolean; message?: string }> {
  const { questionId, subject, lesson } = params;
  if (!questionId || !subject || !lesson) {
    return { success: false, message: 'Missing required parameters for deletion.' };
  }

  const questionJsonFilePath = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions', `${questionId}.json`);
  const publicLessonImagesDir = path.join(publicImagesBasePath, subject, lesson, 'images'); // Path to public images

  try {
    let questionImage: string | null = null;
    let explanationImage: string | null = null;
    try {
        const fileContent = await fs.readFile(questionJsonFilePath, 'utf-8');
        const questionData = JSON.parse(fileContent) as QuestionBankItem;
        questionImage = questionData.question.image;
        explanationImage = questionData.explanation.image;
    } catch (readError: any) {
         if (readError.code === 'ENOENT') return { success: false, message: `Question JSON file not found: ${questionId}` };
        console.warn(`Could not read question file ${questionId} to find images, attempting deletion anyway.`);
    }

    await fs.unlink(questionJsonFilePath);
    console.log(`Deleted question JSON: ${questionJsonFilePath}`);

    if (questionImage) {
      try {
        await fs.unlink(path.join(publicLessonImagesDir, questionImage)); // Delete from public
        console.log(`Deleted public question image: ${questionImage}`);
      } catch (imgError: any) {
        if (imgError.code !== 'ENOENT') console.error(`Error deleting public question image ${questionImage}:`, imgError);
        else console.warn(`Public question image ${questionImage} not found, skipping.`);
      }
    }
    if (explanationImage) {
      try {
        await fs.unlink(path.join(publicLessonImagesDir, explanationImage)); // Delete from public
         console.log(`Deleted public explanation image: ${explanationImage}`);
      } catch (imgError: any) {
        if (imgError.code !== 'ENOENT') console.error(`Error deleting public explanation image ${explanationImage}:`, imgError);
         else console.warn(`Public explanation image ${explanationImage} not found, skipping.`);
      }
    }

    return { success: true };

  } catch (error: any) {
    console.error(`Error deleting question ${questionId}:`, error);
    if (error.code === 'ENOENT') return { success: false, message: `Question ${questionId} not found.` };
    return { success: false, message: `Failed to delete question ${questionId}. Reason: ${error.message}` };
  }
}
