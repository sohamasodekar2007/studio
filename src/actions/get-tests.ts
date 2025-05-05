// src/actions/get-tests.ts
'use server';

import type { Test } from '@/types'; // Assuming Test type is defined
import fs from 'fs/promises';
import path from 'path';

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
    return tests as Test[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('tests.json not found. Returning empty array.');
      return []; // File doesn't exist, treat as empty
    }
    console.error('Error reading or parsing tests.json:', error);
    return []; // Return empty array on other errors
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
