// src/actions/test-actions.ts
'use server';

import type { Test } from '@/types'; // Assuming Test type is defined
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Use UUID for new test IDs

const testsFilePath = path.join(process.cwd(), 'src', 'data', 'tests.json');

/**
 * Reads the tests.json file.
 * @returns A promise resolving to an array of Test or an empty array on error.
 */
export async function getTests(): Promise<Test[]> {
  try {
    const fileContent = await fs.readFile(testsFilePath, 'utf-8');
    const tests = JSON.parse(fileContent);
    if (!Array.isArray(tests)) {
      console.error('tests.json does not contain a valid array. Returning empty array.');
      return [];
    }
    // Add basic validation or transformation if needed
    // Ensure date strings are converted to Date objects if necessary, or handle downstream
    return tests as Test[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('tests.json not found. Returning empty array.');
      // Optionally create the file with an empty array
      try {
        await fs.writeFile(testsFilePath, '[]', 'utf-8');
        console.log('Created empty tests.json file.');
        return [];
      } catch (writeError) {
        console.error('Failed to create tests.json:', writeError);
        return [];
      }
    }
    console.error('Error reading or parsing tests.json:', error);
    return []; // Return empty array on other errors
  }
}

/**
 * Writes the tests array to the tests.json file.
 * @param tests The array of Test objects to write.
 * @returns A promise resolving to true on success, false on error.
 */
async function writeTests(tests: Test[]): Promise<boolean> {
    try {
        await fs.writeFile(testsFilePath, JSON.stringify(tests, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write tests.json:', error);
        return false;
    }
}


/**
 * Finds a single test by its ID in the local tests.json file.
 * @param testId The ID of the test to find.
 * @returns A promise resolving to the Test if found, otherwise null.
 */
export async function getTestById(testId: string): Promise<Test | null> {
    if (!testId) {
        return null;
    }
    try {
        const tests = await getTests();
        const foundTest = tests.find((t) => t.id === testId);
        return foundTest || null;
    } catch (error) {
        console.error(`Error finding test by ID ${testId}:`, error);
        return null;
    }
}

/**
 * Adds a new test to the tests.json file.
 * @param newTestData The test data object (excluding id, createdAt, updatedAt - they will be generated).
 * @returns A promise resolving with success status, the new test object (or null on failure), and optional message.
 */
export async function addTestToJson(newTestData: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; test: Test | null; message?: string }> {
    try {
        const tests = await getTests();
        const newTest: Test = {
            ...newTestData,
            id: uuidv4(), // Generate a unique ID
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            published: newTestData.published ?? false, // Default published to false if not provided
        };

        tests.push(newTest);

        const success = await writeTests(tests);
        if (success) {
            return { success: true, test: newTest };
        } else {
            return { success: false, test: null, message: 'Failed to write tests file.' };
        }
    } catch (error) {
        console.error('Error adding test to JSON:', error);
        return { success: false, test: null, message: 'Failed to add test.' };
    }
}

/**
 * Updates an existing test in the tests.json file by ID.
 * @param testId The ID of the test to update.
 * @param updatedData Partial test data to update. Only provided fields will be changed.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateTestInJson(testId: string, updatedData: Partial<Omit<Test, 'id' | 'createdAt'>>): Promise<{ success: boolean; message?: string }> {
    try {
        let tests = await getTests();
        const testIndex = tests.findIndex(t => t.id === testId);

        if (testIndex === -1) {
            return { success: false, message: `Test with ID ${testId} not found.` };
        }

        // Merge existing data with updated data and update timestamp
        tests[testIndex] = {
            ...tests[testIndex], // Keep existing data
            ...updatedData,      // Apply updates
            id: testId,          // Ensure ID remains the same
            updatedAt: new Date().toISOString(), // Update the timestamp
        };

        const success = await writeTests(tests);
        return { success, message: success ? undefined : 'Failed to write tests file.' };
    } catch (error) {
        console.error(`Error updating test ${testId} in JSON:`, error);
        return { success: false, message: 'Failed to update test.' };
    }
}

/**
 * Deletes a test from the tests.json file by ID.
 * @param testId The ID of the test to delete.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteTestFromJson(testId: string): Promise<{ success: boolean; message?: string }> {
    try {
        let tests = await getTests();
        const initialLength = tests.length;
        tests = tests.filter(t => t.id !== testId);

        if (tests.length === initialLength) {
            return { success: false, message: `Test with ID ${testId} not found.` };
        }

        const success = await writeTests(tests);
        return { success, message: success ? undefined : 'Failed to write tests file.' };
    } catch (error) {
        console.error(`Error deleting test ${testId} from JSON:`, error);
        return { success: false, message: 'Failed to delete test.' };
    }
}
