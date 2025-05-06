
// src/actions/generated-test-actions.ts
'use server';

import type { GeneratedTest } from '@/types';
import fs from 'fs/promises';
import path from 'path';

// Define the base path for saving generated test JSON files
const generatedTestsBasePath = path.join(process.cwd(), 'src', 'data', 'tests_json');

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
 * Saves the generated test definition JSON to the tests_json folder.
 * The filename will be the unique test_code.
 *
 * @param testDefinition - The GeneratedTest object containing all test details.
 * @returns A promise resolving with success status, optional message, and the file path where it was saved.
 */
export async function saveGeneratedTest(
    testDefinition: GeneratedTest
): Promise<{ success: boolean; message?: string; filePath?: string }> {
    const targetDir = generatedTestsBasePath;
    const filePath = path.join(targetDir, `${testDefinition.test_code}.json`);

    try {
        await ensureDirExists(targetDir); // Ensure the base directory exists

        // Optionally add/update a 'modifiedAt' timestamp if needed
        const dataToSave = {
            ...testDefinition,
            // modifiedAt: new Date().toISOString(), // Uncomment if needed
        };

        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        console.log(`Generated test definition saved: ${filePath}`);
        return { success: true, message: `Test ${testDefinition.test_code} saved successfully.`, filePath };

    } catch (error: any) {
        console.error(`Error saving generated test definition ${testDefinition.test_code}:`, error);
        return { success: false, message: `Failed to save test definition. Reason: ${error.message}` };
    }
}


/**
 * Reads all generated test JSON files from the tests_json directory.
 * @returns A promise resolving to an array of GeneratedTest objects or an empty array on error.
 */
export async function getAllGeneratedTests(): Promise<GeneratedTest[]> {
  try {
    // Ensure the directory exists, create if not
    await ensureDirExists(generatedTestsBasePath);

    const files = await fs.readdir(generatedTestsBasePath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const allTests: GeneratedTest[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(generatedTestsBasePath, file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const testData = JSON.parse(fileContent) as GeneratedTest;
        // Basic validation (check for required fields)
        if (testData.test_code && testData.name && testData.test_subject && testData.type) {
          allTests.push(testData);
        } else {
          console.warn(`Skipping invalid test file (missing core fields): ${filePath}`);
        }
      } catch (parseError) {
        console.error(`Error parsing test file ${filePath}:`, parseError);
        // Optionally skip this file or handle the error differently
      }
    }
    // Sort tests by creation date descending (newest first) if createdAt exists
    allTests.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0; // No sorting if createdAt is missing
    });


    return allTests;
  } catch (error: any) {
     if (error.code === 'ENOENT') {
        // This case should be handled by ensureDirExists, but good fallback
        console.warn(`Generated tests directory not found: ${generatedTestsBasePath}. Returning empty array.`);
        return [];
     }
     console.error('Error reading generated tests:', error);
     // Consider throwing a more specific error if needed by the caller
     return []; // Return empty on other errors
  }
}


/**
 * Deletes a specific generated test JSON file by its test code.
 * @param testCode The unique code of the test to delete.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteGeneratedTest(testCode: string): Promise<{ success: boolean; message?: string }> {
  if (!testCode) {
    return { success: false, message: 'Test code is required for deletion.' };
  }

  const filePath = path.join(generatedTestsBasePath, `${testCode}.json`);

  try {
    await fs.unlink(filePath);
    console.log(`Deleted generated test file: ${filePath}`);
    return { success: true };

  } catch (error: any) {
    console.error(`Error deleting generated test ${testCode}:`, error);
    if (error.code === 'ENOENT') {
      return { success: false, message: `Test file with code ${testCode} not found.` };
    }
    return { success: false, message: `Failed to delete test ${testCode}. Reason: ${error.message}` };
  }
}

// --- TODO: Add functions for updating a generated test if needed ---
// export async function updateGeneratedTest(...) { ... }

// --- TODO: Add function to get a single test by code ---
// export async function getGeneratedTestByCode(testCode: string): Promise<GeneratedTest | null> { ... }
