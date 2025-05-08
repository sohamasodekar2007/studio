// src/actions/question-bank-query-actions.ts
'use server';

import type { QuestionBankItem, ClassLevel, ExamOption } from '@/types';
import fs from 'fs/promises';
import path from 'path';

// Base path for JSON question data files
const jsonQuestionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');
// Base path for publicly served images
const publicImagesBasePath = path.join(process.cwd(), 'public', 'question_bank_images');

/** Helper to ensure directory exists */
async function ensureDirExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
    }
  }


/**
 * Retrieves a list of available subjects by reading directory names from the JSON data path.
 * @returns A promise resolving to an array of subject names.
 */
export async function getSubjects(): Promise<string[]> {
  try {
    await ensureDirExists(jsonQuestionBankBasePath); // Ensure base dir exists
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
    await ensureDirExists(subjectJsonPath); // Ensure subject dir exists
    const entries = await fs.readdir(subjectJsonPath, { withFileTypes: true });
    const lessons = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'images' && entry.name !== 'questions')
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
 * Helper function to read a single question file safely.
 * @param filePath Path to the question JSON file.
 * @returns The parsed QuestionBankItem or null if error/invalid.
 */
async function readQuestionFile(filePath: string): Promise<QuestionBankItem | null> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const questionData = JSON.parse(fileContent) as QuestionBankItem;
        // Basic validation
        if (questionData.id && questionData.subject && questionData.lesson && questionData.options && questionData.correct) {
             return questionData;
        } else {
            console.warn(`Skipping invalid question JSON file (missing core fields): ${filePath}`);
            return null;
        }
    } catch (parseError) {
        console.error(`Error parsing question file ${filePath}:`, parseError);
        return null;
    }
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
  const filteredQuestions: QuestionBankItem[] = [];

  try {
    await ensureDirExists(questionsJsonDir); // Ensure the directory exists
    const files = await fs.readdir(questionsJsonDir);
    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));

    for (const file of jsonFiles) {
        const filePath = path.join(questionsJsonDir, file);
        const questionData = await readQuestionFile(filePath);
        if (questionData) {
            // Apply filters
            let matches = true;
            if (classFilter && questionData.class !== classFilter) matches = false;
            if (examFilter && questionData.examType !== examFilter) matches = false;
            // Add more filters here if needed (e.g., difficulty, tags)
            if (matches) {
                filteredQuestions.push(questionData);
            }
        }
    }
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
  const publicLessonImagesDir = path.join(publicImagesBasePath, subject, lesson, 'images');

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

    // Attempt to delete images from public directory
    if (questionImage) {
      try {
        await fs.unlink(path.join(publicLessonImagesDir, questionImage));
        console.log(`Deleted public question image: ${questionImage}`);
      } catch (imgError: any) {
        if (imgError.code !== 'ENOENT') console.error(`Error deleting public question image ${questionImage}:`, imgError);
        else console.warn(`Public question image ${questionImage} not found, skipping.`);
      }
    }
    if (explanationImage) {
      try {
        await fs.unlink(path.join(publicLessonImagesDir, explanationImage));
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

// --- PYQ Specific Actions ---

/**
 * Scans the entire question bank and returns a unique list of exam names
 * for which PYQs exist (based on the pyqDetails.exam field).
 * @returns A promise resolving to an array of unique PYQ exam names.
 */
export async function getAvailablePyqExams(): Promise<string[]> {
    const pyqExams = new Set<string>();
    try {
        const subjects = await getSubjects();
        for (const subject of subjects) {
            const lessons = await getLessonsForSubject(subject);
            for (const lesson of lessons) {
                const questionsDir = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions');
                try {
                    const files = await fs.readdir(questionsDir);
                    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));
                    for (const file of jsonFiles) {
                        const filePath = path.join(questionsDir, file);
                        const qData = await readQuestionFile(filePath);
                        if (qData?.isPyq && qData.pyqDetails?.exam) {
                            pyqExams.add(qData.pyqDetails.exam);
                        }
                    }
                } catch (readDirError: any) {
                    if (readDirError.code !== 'ENOENT') {
                        console.error(`Error reading questions directory ${questionsDir}:`, readDirError);
                    }
                    // Continue scanning other lessons/subjects
                }
            }
        }
        return Array.from(pyqExams);
    } catch (error) {
        console.error("Error scanning for available PYQ exams:", error);
        return []; // Return empty array on error
    }
}

/**
 * Retrieves subjects and their lessons that contain PYQs for a specific exam.
 * @param examName The name of the target exam.
 * @returns A promise resolving to an array of { subject: string, lessons: string[] }.
 */
export async function getSubjectsAndLessonsForPyqExam(examName: ExamOption): Promise<{ subject: string; lessons: string[] }[]> {
    const result: { [subject: string]: Set<string> } = {};

    try {
        const subjects = await getSubjects();
        for (const subject of subjects) {
            const lessons = await getLessonsForSubject(subject);
            for (const lesson of lessons) {
                const questionsDir = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions');
                try {
                    const files = await fs.readdir(questionsDir);
                    const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));
                    for (const file of jsonFiles) {
                        const filePath = path.join(questionsDir, file);
                        const qData = await readQuestionFile(filePath);
                        if (qData?.isPyq && qData.pyqDetails?.exam === examName) {
                             if (!result[subject]) {
                                 result[subject] = new Set();
                             }
                             result[subject].add(lesson);
                             break; // Found a matching PYQ in this lesson, move to the next lesson
                        }
                    }
                } catch (readDirError: any) {
                     if (readDirError.code !== 'ENOENT') {
                         console.error(`Error reading PYQ questions directory ${questionsDir}:`, readDirError);
                     }
                }
            }
        }

        // Convert result map to the desired array format
        return Object.entries(result).map(([subject, lessonsSet]) => ({
            subject,
            lessons: Array.from(lessonsSet).sort() // Sort lessons alphabetically
        })).sort((a, b) => a.subject.localeCompare(b.subject)); // Sort subjects alphabetically

    } catch (error) {
        console.error(`Error fetching subjects/lessons for PYQ exam ${examName}:`, error);
        return [];
    }
}

/**
 * Retrieves only the PYQ questions for a specific lesson and exam.
 * @param examName The specific exam name to filter by.
 * @param subject The subject name.
 * @param lesson The lesson name.
 * @returns A promise resolving to an array of PYQ QuestionBankItems.
 */
export async function getPyqQuestionsForLesson(examName: ExamOption, subject: string, lesson: string): Promise<QuestionBankItem[]> {
    if (!examName || !subject || !lesson) {
        console.warn("Exam, Subject, and Lesson are required to fetch PYQ questions.");
        return [];
    }

    const questionsJsonDir = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions');
    const pyqQuestions: QuestionBankItem[] = [];

    try {
        await ensureDirExists(questionsJsonDir); // Ensure the directory exists
        const files = await fs.readdir(questionsJsonDir);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file.startsWith('Q_'));

        for (const file of jsonFiles) {
            const filePath = path.join(questionsJsonDir, file);
            const questionData = await readQuestionFile(filePath);
            // Filter specifically for PYQs matching the examName
            if (questionData?.isPyq && questionData.pyqDetails?.exam === examName) {
                pyqQuestions.push(questionData);
            }
        }
        return pyqQuestions;

    } catch (error: any) {
       if (error.code === 'ENOENT') {
         console.warn(`PYQ Questions JSON directory not found: ${questionsJsonDir}. Returning empty array.`);
         return [];
       }
       console.error(`Error reading PYQ questions for ${examName}/${subject}/${lesson}:`, error);
       throw new Error(`Failed to retrieve PYQ questions for ${subject}/${lesson}.`);
    }
}
