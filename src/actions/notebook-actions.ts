// src/actions/notebook-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { UserNotebookData, Notebook, BookmarkedQuestion, QuestionBankItem } from '@/types';

const notebooksBasePath = path.join(process.cwd(), 'src', 'data', 'user-notebooks');
const questionBankBasePath = path.join(process.cwd(), 'src', 'data', 'question_bank');

// Helper function to ensure directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
        if (error.code !== 'EEXIST') throw error;
    }
}

// Helper function to read user notebook data
async function readUserNotebooks(userId: string): Promise<UserNotebookData> {
    const userDir = path.join(notebooksBasePath, userId);
    const filePath = path.join(userDir, 'notebooks.json');
    try {
        await ensureDirExists(userDir);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent) as UserNotebookData;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return default structure
            return { userId, notebooks: [], bookmarkedQuestions: {} };
        }
        console.error(`Error reading notebooks for user ${userId}:`, error);
        throw new Error('Could not load notebook data.');
    }
}

// Helper function to write user notebook data
async function writeUserNotebooks(userId: string, data: UserNotebookData): Promise<void> {
    const userDir = path.join(notebooksBasePath, userId);
    const filePath = path.join(userDir, 'notebooks.json');
    try {
        await ensureDirExists(userDir);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error: any) {
        console.error(`Error writing notebooks for user ${userId}:`, error);
        throw new Error('Could not save notebook data.');
    }
}

/**
 * Retrieves all notebooks and bookmarked questions for a specific user.
 * @param userId - The ID of the user.
 * @returns A promise resolving to the UserNotebookData object.
 */
export async function getUserNotebooks(userId: string): Promise<UserNotebookData> {
     if (!userId) throw new Error("User ID is required.");
     return readUserNotebooks(userId);
}

/**
 * Creates a new notebook for a user.
 * @param userId - The ID of the user.
 * @param notebookName - The name of the new notebook.
 * @returns A promise resolving with success status and the created notebook object.
 */
export async function createNotebook(userId: string, notebookName: string): Promise<{ success: boolean; notebook?: Notebook; message?: string }> {
    if (!userId || !notebookName.trim()) {
        return { success: false, message: "User ID and notebook name are required." };
    }

    try {
        const data = await readUserNotebooks(userId);

        // Check if notebook name already exists (case-insensitive)
        if (data.notebooks.some(nb => nb.name.toLowerCase() === notebookName.trim().toLowerCase())) {
            return { success: false, message: `Notebook "${notebookName.trim()}" already exists.` };
        }

        const newNotebook: Notebook = {
            id: uuidv4(),
            name: notebookName.trim(),
            createdAt: Date.now(),
        };

        data.notebooks.push(newNotebook);
        data.bookmarkedQuestions[newNotebook.id] = []; // Initialize empty array for bookmarks

        await writeUserNotebooks(userId, data);

        return { success: true, notebook: newNotebook };
    } catch (error: any) {
        console.error(`Error creating notebook for user ${userId}:`, error);
        return { success: false, message: error.message || "Could not create notebook." };
    }
}

/**
 * Deletes a notebook and all its associated bookmarks for a user.
 * @param userId - The ID of the user.
 * @param notebookId - The ID of the notebook to delete.
 * @returns A promise resolving with success status.
 */
export async function deleteNotebook(userId: string, notebookId: string): Promise<{ success: boolean; message?: string }> {
    if (!userId || !notebookId) {
        return { success: false, message: "User ID and Notebook ID are required." };
    }
    try {
        const data = await readUserNotebooks(userId);

        const initialLength = data.notebooks.length;
        data.notebooks = data.notebooks.filter(nb => nb.id !== notebookId);

        if (data.notebooks.length === initialLength) {
             return { success: false, message: "Notebook not found." };
        }

        // Remove associated bookmarks
        delete data.bookmarkedQuestions[notebookId];

        await writeUserNotebooks(userId, data);
        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting notebook ${notebookId} for user ${userId}:`, error);
        return { success: false, message: error.message || "Could not delete notebook." };
    }
}

/**
 * Adds a question to one or more notebooks for a user.
 * @param userId - The ID of the user.
 * @param notebookIds - An array of notebook IDs to add the question to.
 * @param question - The BookmarkedQuestion object to add.
 * @returns A promise resolving with success status.
 */
export async function addQuestionToNotebooks(userId: string, notebookIds: string[], question: BookmarkedQuestion): Promise<{ success: boolean; message?: string }> {
     if (!userId || notebookIds.length === 0 || !question || !question.questionId) {
        return { success: false, message: "User ID, Notebook IDs, and Question details are required." };
     }
     try {
        const data = await readUserNotebooks(userId);

         let addedCount = 0;
         for (const notebookId of notebookIds) {
             // Check if the notebook exists
             if (data.notebooks.some(nb => nb.id === notebookId)) {
                 // Initialize if the notebook has no bookmarks yet
                 if (!data.bookmarkedQuestions[notebookId]) {
                     data.bookmarkedQuestions[notebookId] = [];
                 }
                 // Check if question is already bookmarked in this notebook
                 if (!data.bookmarkedQuestions[notebookId].some(bq => bq.questionId === question.questionId)) {
                     data.bookmarkedQuestions[notebookId].push(question);
                     addedCount++;
                 } else {
                     // Optionally update tags if already present
                     const existingIndex = data.bookmarkedQuestions[notebookId].findIndex(bq => bq.questionId === question.questionId);
                     if (existingIndex !== -1) {
                         data.bookmarkedQuestions[notebookId][existingIndex].tags = question.tags; // Update tags
                         data.bookmarkedQuestions[notebookId][existingIndex].addedAt = question.addedAt; // Update timestamp
                     }
                 }
             } else {
                 console.warn(`Notebook ID ${notebookId} not found for user ${userId}. Skipping.`);
             }
         }

         if (addedCount > 0 || notebookIds.some(id => data.bookmarkedQuestions[id]?.some(q => q.questionId === question.questionId))) { // Check if added or tags updated
             await writeUserNotebooks(userId, data);
         }

        return { success: true };
     } catch (error: any) {
        console.error(`Error adding question ${question.questionId} to notebooks for user ${userId}:`, error);
        return { success: false, message: error.message || "Could not add question to notebooks." };
     }
}


/**
 * Removes a question from a specific notebook for a user.
 * @param userId - The ID of the user.
 * @param notebookId - The ID of the notebook.
 * @param questionId - The ID of the question to remove.
 * @returns A promise resolving with success status.
 */
export async function removeQuestionFromNotebook(userId: string, notebookId: string, questionId: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || !notebookId || !questionId) {
        return { success: false, message: "User ID, Notebook ID, and Question ID are required." };
     }
     try {
        const data = await readUserNotebooks(userId);

         if (!data.bookmarkedQuestions[notebookId]) {
             return { success: false, message: "Notebook not found or is empty." };
         }

         const initialLength = data.bookmarkedQuestions[notebookId].length;
         data.bookmarkedQuestions[notebookId] = data.bookmarkedQuestions[notebookId].filter(q => q.questionId !== questionId);

         if (data.bookmarkedQuestions[notebookId].length === initialLength) {
             return { success: false, message: "Question not found in this notebook." };
         }

         await writeUserNotebooks(userId, data);
         return { success: true };

     } catch (error: any) {
          console.error(`Error removing question ${questionId} from notebook ${notebookId} for user ${userId}:`, error);
          return { success: false, message: error.message || "Could not remove question from notebook." };
     }
}


/**
 * Fetches the full data for a specific question from the question bank.
 * Used by the notebook page to display question previews.
 * @param questionId The ID of the question.
 * @param subject The subject of the question.
 * @param lesson The lesson of the question.
 * @returns A promise resolving to the QuestionBankItem or null if not found.
 */
export async function getQuestionById(questionId: string, subject: string, lesson: string): Promise<QuestionBankItem | null> {
  if (!questionId || !subject || !lesson) return null;
  const filePath = path.join(questionBankBasePath, subject, lesson, 'questions', `${questionId}.json`);
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent) as QuestionBankItem;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`Question file not found: ${filePath}`);
    } else {
      console.error(`Error reading question file ${filePath}:`, error);
    }
    return null;
  }
}
