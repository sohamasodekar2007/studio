// src/actions/question-bank-actions.ts
'use server';

import type { QuestionBankItem, QuestionType, DifficultyLevel, ExamOption, ClassLevel, PyqShift } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Base path for JSON question data files
const jsonQuestionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');
// Base path for publicly served images (for next/image)
const publicImagesBasePath = path.join(process.cwd(), 'public', 'question_bank_images');


// Helper function to ensure directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error; // Re-throw if error is not "directory already exists"
    }
  }
}

// Helper function to generate a unique filename
async function generateUniqueFilename(prefix: 'Q' | 'E', fileExtension: string, fileBuffer: Buffer): Promise<string> {
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 6);
    return `${prefix}_${timestamp}_${hash}.${fileExtension.toLowerCase()}`;
}

// Helper function to save an image file to the public directory
async function saveImage(
    file: File,
    subject: string,
    lesson: string,
    prefix: 'Q' | 'E'
): Promise<string | null> {
    try {
        // Images are saved relative to the publicImagesBasePath
        const imagesDir = path.join(publicImagesBasePath, subject, lesson, 'images');
        await ensureDirExists(imagesDir);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = path.extname(file.name).substring(1);
        const uniqueFilename = await generateUniqueFilename(prefix, fileExtension, fileBuffer);
        const filePath = path.join(imagesDir, uniqueFilename);

        await fs.writeFile(filePath, fileBuffer);
        console.log(`Image saved to public path: ${filePath}`);
        return uniqueFilename; // Return only the filename

    } catch (error) {
        console.error(`Error saving ${prefix} image:`, error);
        return null;
    }
}


/**
 * Adds a new question (including handling image uploads) to the local question bank.
 * Question JSON data is stored in `src/data/question_bank`.
 * Images are stored in `public/question_bank_images`.
 *
 * @param formData - The FormData object containing question details and optional images.
 * @returns A promise resolving with success status, the new question object (or null on failure), and optional error message.
 */
export async function addQuestionToBank(
    formData: FormData
): Promise<{ success: boolean; question: QuestionBankItem | null; error?: string }> {
    console.log("Received FormData Keys for Add Question:", Array.from(formData.keys()));

    try {
        // --- Extract Data ---
        const subject = formData.get('subject') as string;
        const lesson = formData.get('lesson') as string;
        const classLevel = formData.get('class') as ClassLevel;
        const examType = formData.get('examType') as ExamOption;
        const difficulty = formData.get('difficulty') as DifficultyLevel;
        const tagsString = formData.get('tags') as string || '';
        const questionType = formData.get('questionType') as QuestionType;
        const questionText = formData.get('questionText') as string | null;
        const optionA = formData.get('optionA') as string | null;
        const optionB = formData.get('optionB') as string | null;
        const optionC = formData.get('optionC') as string | null;
        const optionD = formData.get('optionD') as string | null;
        const correctAnswer = formData.get('correctAnswer') as "A" | "B" | "C" | "D";
        const explanationText = formData.get('explanationText') as string | null;

        const questionImageFile = formData.get('questionImage') as File | null;
        const explanationImageFile = formData.get('explanationImage') as File | null;

        // Extract PYQ Data
        const isPyq = formData.get('isPyq') === 'true';
        const pyqExam = formData.get('pyqExam') as ExamOption | null;
        const pyqDateString = formData.get('pyqDate') as string | null; // Date as YYYY-MM-DD string
        const pyqShift = formData.get('pyqShift') as PyqShift | null;

        // --- Basic Validation ---
        if (!subject || !lesson || !classLevel || !examType || !difficulty || !questionType || !correctAnswer) {
            return { success: false, question: null, error: 'Missing required base fields.' };
        }
        if (questionType === 'text' && (!questionText || !optionA || !optionB || !optionC || !optionD)) {
             return { success: false, question: null, error: 'Text question requires question text and all options.' };
        }
        if (questionType === 'image' && !questionImageFile) {
             return { success: false, question: null, error: 'Image question requires an image upload.' };
        }
        // PYQ Validation
        if (isPyq && (!pyqExam || !pyqDateString || !pyqShift)) {
             return { success: false, question: null, error: 'PYQ requires Exam, Date, and Shift.' };
        }


        // --- Prepare Directory Structure for JSON files ---
        const lessonJsonDir = path.join(jsonQuestionBankBasePath, subject, lesson);
        const questionsJsonDir = path.join(lessonJsonDir, 'questions');
        await ensureDirExists(lessonJsonDir);
        await ensureDirExists(questionsJsonDir);

        // --- Handle Image Uploads (saves to public directory) ---
        let questionImageFilename: string | null = null;
        if (questionType === 'image' && questionImageFile) {
            questionImageFilename = await saveImage(questionImageFile, subject, lesson, 'Q');
            if (!questionImageFilename) {
                return { success: false, question: null, error: 'Failed to save question image.' };
            }
        }

        let explanationImageFilename: string | null = null;
        if (explanationImageFile) {
            explanationImageFilename = await saveImage(explanationImageFile, subject, lesson, 'E');
             if (!explanationImageFilename) {
                 console.warn('Failed to save explanation image, but proceeding with question save.');
             }
        }


        // --- Create Question Object ---
        const timestamp = Date.now();
        const questionId = `Q_${timestamp}`;
        const nowISO = new Date().toISOString();

        const newQuestion: QuestionBankItem = {
            id: questionId,
            subject,
            lesson,
            class: classLevel,
            examType,
            difficulty,
            tags: tagsString.split(',').map(tag => tag.trim()).filter(tag => tag),
            type: questionType,
            question: {
                text: questionType === 'text' ? questionText : null,
                image: questionType === 'image' ? questionImageFilename : null, // Just the filename
            },
            options: questionType === 'image' ? { A: 'A', B: 'B', C: 'C', D: 'D' } : {
                A: optionA || '',
                B: optionB || '',
                C: optionC || '',
                D: optionD || '',
            },
            correct: correctAnswer,
            explanation: {
                text: explanationText || null,
                image: explanationImageFilename, // Just the filename
            },
            isPyq: isPyq,
            pyqDetails: isPyq && pyqExam && pyqDateString && pyqShift ? {
                exam: pyqExam,
                date: pyqDateString, // Store as YYYY-MM-DD string
                shift: pyqShift,
            } : null,
            created: nowISO,
            modified: nowISO,
        };

        // --- Save Question JSON to src/data/... ---
        const questionJsonFilePath = path.join(questionsJsonDir, `${questionId}.json`);
        await fs.writeFile(questionJsonFilePath, JSON.stringify(newQuestion, null, 2), 'utf-8');
        console.log(`Question JSON saved: ${questionJsonFilePath}`);

        return { success: true, question: newQuestion };

    } catch (error: any) {
        console.error('Error adding question to bank:', error);
        return { success: false, question: null, error: error.message || 'An unknown error occurred while saving the question.' };
    }
}


/**
 * Updates specific details of an existing question.
 * Images are saved/deleted from `public/question_bank_images`.
 * JSON is updated in `src/data/question_bank`.
 *
 * @param formData - FormData containing questionId, subject, lesson, correctAnswer, explanationText, and optional new explanationImage.
 * @returns A promise resolving with success status, the updated question object (or null on failure), and optional error message.
 */
export async function updateQuestionDetails(
    formData: FormData
): Promise<{ success: boolean; question: QuestionBankItem | null; error?: string }> {
    console.log("Received FormData Keys for Update:", Array.from(formData.keys()));

    try {
        const questionId = formData.get('questionId') as string;
        const subject = formData.get('subject') as string;
        const lesson = formData.get('lesson') as string;
        const correctAnswer = formData.get('correctAnswer') as "A" | "B" | "C" | "D";
        const explanationText = formData.get('explanationText') as string | null;
        const explanationImageFile = formData.get('explanationImage') as File | null;
        const removeExplanationImage = formData.get('removeExplanationImage') === 'true';

        // Note: PYQ details are not currently updatable via this function.
        // They are set only during creation. If needed, add fields to update PYQ status/details.

        if (!questionId || !subject || !lesson || !correctAnswer) {
            return { success: false, question: null, error: 'Missing required fields for update.' };
        }

        // Paths for JSON and public images
        const questionsJsonDir = path.join(jsonQuestionBankBasePath, subject, lesson, 'questions');
        const questionJsonFilePath = path.join(questionsJsonDir, `${questionId}.json`);
        const publicLessonImagesDir = path.join(publicImagesBasePath, subject, lesson, 'images'); // For deleting/saving new images

        let existingQuestion: QuestionBankItem;
        try {
            const fileContent = await fs.readFile(questionJsonFilePath, 'utf-8');
            existingQuestion = JSON.parse(fileContent) as QuestionBankItem;
        } catch (readError: any) {
            if (readError.code === 'ENOENT') return { success: false, question: null, error: `Question file not found: ${questionId}` };
            console.error(`Error reading existing question file ${questionId}:`, readError);
            return { success: false, question: null, error: 'Could not read existing question data.' };
        }

        const existingExplanationImageFilename = existingQuestion.explanation.image;
        let newExplanationImageFilename: string | null = existingExplanationImageFilename;

        if (explanationImageFile) { // New image uploaded
            if (existingExplanationImageFilename) {
                try {
                    await fs.unlink(path.join(publicLessonImagesDir, existingExplanationImageFilename));
                    console.log(`Deleted old public explanation image: ${existingExplanationImageFilename}`);
                } catch (delError: any) {
                    if (delError.code !== 'ENOENT') console.warn(`Could not delete old public explanation image ${existingExplanationImageFilename}:`, delError);
                }
            }
            newExplanationImageFilename = await saveImage(explanationImageFile, subject, lesson, 'E'); // Saves to public
            if (!newExplanationImageFilename) {
                console.warn('Failed to save new explanation image, update proceeding without image change.');
                newExplanationImageFilename = null;
            }
        } else if (removeExplanationImage && existingExplanationImageFilename) { // Remove existing image
             try {
                 await fs.unlink(path.join(publicLessonImagesDir, existingExplanationImageFilename));
                 console.log(`Deleted existing public explanation image: ${existingExplanationImageFilename}`);
                 newExplanationImageFilename = null;
             } catch (delError: any) {
                 if (delError.code !== 'ENOENT') console.warn(`Could not delete existing public explanation image ${existingExplanationImageFilename}:`, delError);
                 newExplanationImageFilename = null;
             }
        }

        const nowISO = new Date().toISOString();
        const updatedQuestion: QuestionBankItem = {
            ...existingQuestion, // Retain all existing data, including PYQ details
            correct: correctAnswer,
            explanation: {
                text: explanationText || null,
                image: newExplanationImageFilename, // Store just the filename
            },
            modified: nowISO,
        };

        await fs.writeFile(questionJsonFilePath, JSON.stringify(updatedQuestion, null, 2), 'utf-8');
        console.log(`Updated Question JSON saved: ${questionJsonFilePath}`);

        return { success: true, question: updatedQuestion };

    } catch (error: any) {
        console.error(`Error updating question ${formData.get('questionId')}:`, error);
        return { success: false, question: null, error: error.message || 'An unknown error occurred.' };
    }
}