'use server';

import type { ChapterwiseTestJson, FullLengthTestJson } from '@/types';
import fs from 'fs/promises';
import path from 'path';

const testPagesBasePath = path.join(process.cwd(), 'src', 'data', 'test_pages');

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

/**
 * Saves the generated test definition JSON to the appropriate folder.
 *
 * @param testDefinition - The test definition object (either Chapterwise or Full-Length).
 * @returns A promise resolving with success status, optional message, and the file path where it was saved.
 */
export async function saveGeneratedTest(
    testDefinition: ChapterwiseTestJson | FullLengthTestJson
): Promise<{ success: boolean; message?: string; filePath?: string }> {
    const folder = testDefinition.type === 'chapterwise' ? 'chapterwise' : 'full_length';
    const targetDir = path.join(testPagesBasePath, folder);
    const filePath = path.join(targetDir, `${testDefinition.test_id}.json`);

    try {
        await ensureDirExists(targetDir); // Ensure the directory exists

        // Add modified timestamp before saving
        const dataToSave = {
            ...testDefinition,
            modifiedAt: new Date().toISOString(), // Add or update modified timestamp
        };

        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        console.log(`Test definition saved: ${filePath}`);
        return { success: true, message: `Test saved successfully.`, filePath };

    } catch (error: any) {
        console.error(`Error saving test definition ${testDefinition.test_id}:`, error);
        return { success: false, message: `Failed to save test definition. Reason: ${error.message}` };
    }
}
