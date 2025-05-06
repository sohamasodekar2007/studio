'use server';

import type { QuestionBankItem, QuestionType, DifficultyLevel, ExamOption, ClassLevel } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const questionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');

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
    // Create a hash of the file content for uniqueness against identical uploads
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 6);
    return `${prefix}_${timestamp}_${hash}.${fileExtension.toLowerCase()}`;
}

// Helper function to save an image file
async function saveImage(
    file: File,
    subject: string,
    lesson: string,
    prefix: 'Q' | 'E'
): Promise<string | null> {
    try {
        const imagesDir = path.join(questionBankBasePath, subject, lesson, 'images');
        await ensureDirExists(imagesDir);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = path.extname(file.name).substring(1); // Get extension without dot
        const uniqueFilename = await generateUniqueFilename(prefix, fileExtension, fileBuffer);
        const filePath = path.join(imagesDir, uniqueFilename);

        await fs.writeFile(filePath, fileBuffer);
        console.log(`Image saved: ${filePath}`);
        return uniqueFilename; // Return only the filename, not the full path

    } catch (error) {
        console.error(`Error saving ${prefix} image:`, error);
        return null; // Indicate failure
    }
}


/**
 * Adds a new question (including handling image uploads) to the local question bank.
 * Data is stored in a JSON file within a structured directory.
 *
 * @param formData - The FormData object containing question details and optional images.
 * @returns A promise resolving with success status, the new question object (or null on failure), and optional error message.
 */
export async function addQuestionToBank(
    formData: FormData
): Promise<{ success: boolean; question: QuestionBankItem | null; error?: string }}> {
    console.log("Received FormData Keys:", Array.from(formData.keys()));

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

        // --- Basic Validation ---
        if (!subject || !lesson || !classLevel || !examType || !difficulty || !questionType || !correctAnswer) {
            return { success: false, question: null, error: 'Missing required fields.' };
        }
        if (questionType === 'text' && (!questionText || !optionA || !optionB || !optionC || !optionD)) {
             return { success: false, question: null, error: 'Text question requires question text and all options.' };
        }
        if (questionType === 'image' && !questionImageFile) {
             return { success: false, question: null, error: 'Image question requires an image upload.' };
        }

        // --- Prepare Directory Structure ---
        const lessonDir = path.join(questionBankBasePath, subject, lesson);
        const questionsDir = path.join(lessonDir, 'questions');
        await ensureDirExists(lessonDir); // Ensure base subject/lesson dir exists
        await ensureDirExists(questionsDir); // Ensure questions subdir exists

        // --- Handle Image Uploads ---
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
                 // Decide if this is critical - maybe allow saving question without explanation image?
                 console.warn('Failed to save explanation image, but proceeding with question save.');
                // return { success: false, question: null, error: 'Failed to save explanation image.' };
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
            tags: tagsString.split(',').map(tag => tag.trim()).filter(tag => tag), // Parse tags
            type: questionType,
            question: {
                text: questionType === 'text' ? questionText : null,
                image: questionType === 'image' ? questionImageFilename : null,
            },
            // For image questions, default options might be A/B/C/D as text
            options: questionType === 'image' ? { A: 'A', B: 'B', C: 'C', D: 'D' } : {
                A: optionA || '', // Ensure non-null for text questions
                B: optionB || '',
                C: optionC || '',
                D: optionD || '',
            },
            correct: correctAnswer,
            explanation: {
                text: explanationText || null,
                image: explanationImageFilename,
            },
            created: nowISO,
            modified: nowISO,
        };

        // --- Save Question JSON ---
        const questionFilePath = path.join(questionsDir, `${questionId}.json`);
        await fs.writeFile(questionFilePath, JSON.stringify(newQuestion, null, 2), 'utf-8');
        console.log(`Question JSON saved: ${questionFilePath}`);

        // --- TODO: Update Master Index (Optional but recommended) ---
        // You might want a single index file listing all questions for easier lookup.
        // This would involve reading the index, adding the new question's path/ID, and writing it back.


        return { success: true, question: newQuestion };

    } catch (error: any) {
        console.error('Error adding question to bank:', error);
        return { success: false, question: null, error: error.message || 'An unknown error occurred while saving the question.' };
    }
}


/**
 * Updates specific details of an existing question in the question bank.
 * Primarily focuses on updating correct answer and explanation (text and/or image).
 *
 * @param formData - FormData containing the questionId, subject, lesson, correctAnswer, explanationText, and optional new explanationImage.
 * @returns A promise resolving with success status, the updated question object (or null on failure), and optional error message.
 */
export async function updateQuestionDetails(
    formData: FormData
): Promise<{ success: boolean; question: QuestionBankItem | null; error?: string }> {
    console.log("Received FormData Keys for Update:", Array.from(formData.keys()));

    try {
        // --- Extract Data ---
        const questionId = formData.get('questionId') as string;
        const subject = formData.get('subject') as string;
        const lesson = formData.get('lesson') as string;
        const correctAnswer = formData.get('correctAnswer') as "A" | "B" | "C" | "D";
        const explanationText = formData.get('explanationText') as string | null;
        const explanationImageFile = formData.get('explanationImage') as File | null; // New image file
        const removeExplanationImage = formData.get('removeExplanationImage') === 'true'; // Flag to remove existing image

        // --- Basic Validation ---
        if (!questionId || !subject || !lesson || !correctAnswer) {
            return { success: false, question: null, error: 'Missing required fields for update (ID, Subject, Lesson, Correct Answer).' };
        }

        // --- File Paths ---
        const questionsDir = path.join(questionBankBasePath, subject, lesson, 'questions');
        const imagesDir = path.join(questionBankBasePath, subject, lesson, 'images');
        const questionFilePath = path.join(questionsDir, `${questionId}.json`);

        // --- Read Existing Question ---
        let existingQuestion: QuestionBankItem;
        try {
            const fileContent = await fs.readFile(questionFilePath, 'utf-8');
            existingQuestion = JSON.parse(fileContent) as QuestionBankItem;
        } catch (readError: any) {
            if (readError.code === 'ENOENT') {
                return { success: false, question: null, error: `Question file not found: ${questionId}` };
            }
            console.error(`Error reading existing question file ${questionId}:`, readError);
            return { success: false, question: null, error: 'Could not read existing question data.' };
        }

        const existingExplanationImage = existingQuestion.explanation.image;
        let newExplanationImageFilename: string | null = existingExplanationImage; // Default to existing

        // --- Handle Explanation Image Update ---
        // 1. If a new image is uploaded
        if (explanationImageFile) {
            // Delete the old image if it exists
            if (existingExplanationImage) {
                try {
                    await fs.unlink(path.join(imagesDir, existingExplanationImage));
                    console.log(`Deleted old explanation image: ${existingExplanationImage}`);
                } catch (delError: any) {
                    if (delError.code !== 'ENOENT') console.warn(`Could not delete old explanation image ${existingExplanationImage}:`, delError);
                }
            }
            // Save the new image
            newExplanationImageFilename = await saveImage(explanationImageFile, subject, lesson, 'E');
            if (!newExplanationImageFilename) {
                // Decide if this is critical. Maybe allow update without new image saving?
                console.warn('Failed to save new explanation image, update proceeding without image change.');
                 newExplanationImageFilename = null; // Ensure it's null if save failed
                // return { success: false, question: null, error: 'Failed to save new explanation image.' };
            }
        }
        // 2. If the remove flag is set and no new image was uploaded
        else if (removeExplanationImage && existingExplanationImage) {
            // Delete the old image
             try {
                 await fs.unlink(path.join(imagesDir, existingExplanationImage));
                 console.log(`Deleted existing explanation image: ${existingExplanationImage}`);
                  newExplanationImageFilename = null; // Set filename to null
             } catch (delError: any) {
                 if (delError.code !== 'ENOENT') console.warn(`Could not delete existing explanation image ${existingExplanationImage}:`, delError);
                 // Keep existing filename if deletion fails? Or set to null? Let's set to null.
                 newExplanationImageFilename = null;
             }
        }
         // 3. If neither upload nor remove flag, keep the existing image filename (already defaulted)


        // --- Update Question Object ---
        const nowISO = new Date().toISOString();
        const updatedQuestion: QuestionBankItem = {
            ...existingQuestion,
            correct: correctAnswer,
            explanation: {
                text: explanationText || null,
                image: newExplanationImageFilename, // Use the determined filename
            },
            modified: nowISO, // Update modified timestamp
        };

        // --- Save Updated Question JSON ---
        await fs.writeFile(questionFilePath, JSON.stringify(updatedQuestion, null, 2), 'utf-8');
        console.log(`Updated Question JSON saved: ${questionFilePath}`);

        // --- TODO: Update Master Index if needed ---

        return { success: true, question: updatedQuestion };

    } catch (error: any) {
        console.error(`Error updating question ${formData.get('questionId')}:`, error);
        return { success: false, question: null, error: error.message || 'An unknown error occurred while updating the question.' };
    }
}



// --- TODO: Implement other CRUD operations ---
// export async function getQuestionById(id: string): Promise<QuestionBankItem | null> { ... }
// export async function updateQuestion(id: string, data: Partial<QuestionBankItem>, ...): Promise<{ success: boolean; ... }> { ... } // Full update
// export async function deleteQuestion(id: string): Promise<{ success: boolean; ... }> { ... }
// export async function getAllQuestions(filters?): Promise<QuestionBankItem[]> { ... }
