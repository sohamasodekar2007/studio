
// src/actions/generated-test-actions.ts
'use server';

import type { GeneratedTest, ChapterwiseTestJson, FullLengthTestJson } from '@/types'; // Use specific types
import fs from 'fs/promises';
import path from 'path';

// Define the base paths for saving generated test JSON files
const chapterwiseTestsBasePath = path.join(process.cwd(), 'src', 'data', 'test_pages', 'chapterwise');
const fullLengthTestsBasePath = path.join(process.cwd(), 'src', 'data', 'test_pages', 'full_length');

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
 * Saves the generated test definition JSON to the appropriate folder
 * (chapterwise or full_length) based on the test type.
 * The filename will be the unique test_code.
 *
 * @param testDefinition - The GeneratedTest object containing all test details.
 * @returns A promise resolving with success status, optional message, and the file path where it was saved.
 */
export async function saveGeneratedTest(
    testDefinition: GeneratedTest
): Promise<{ success: boolean; message?: string; filePath?: string }> {
    let targetDir: string;
    let filename: string;

    // Determine save directory and filename based on test type
    if (testDefinition.testType === 'chapterwise') {
        targetDir = chapterwiseTestsBasePath;
        filename = `${testDefinition.test_code}.json`;
    } else if (testDefinition.testType === 'full_length') {
        targetDir = fullLengthTestsBasePath;
         filename = `${testDefinition.test_code}.json`;
    } else {
        // Fallback for safety, though should be covered by types
        console.error('Unknown test type provided to saveGeneratedTest:', (testDefinition as any).testType);
        return { success: false, message: 'Invalid test type provided.' };
    }

    const filePath = path.join(targetDir, filename);

    try {
        await ensureDirExists(targetDir); // Ensure the target directory exists

        // Remove the temporary 'testType' discriminator property before saving
        const { testType, ...dataToSave } = testDefinition;

        await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        console.log(`Generated test definition saved: ${filePath}`);
        return { success: true, message: `Test ${testDefinition.test_code} saved successfully.`, filePath };

    } catch (error: any) {
        console.error(`Error saving generated test definition ${testDefinition.test_code}:`, error);
        return { success: false, message: `Failed to save test definition. Reason: ${error.message}` };
    }
}


/**
 * Reads all generated test JSON files from BOTH chapterwise and full_length directories.
 * @returns A promise resolving to an array of GeneratedTest objects or an empty array on error.
 */
export async function getAllGeneratedTests(): Promise<GeneratedTest[]> {
    const allTests: GeneratedTest[] = [];
    const directoriesToScan = [chapterwiseTestsBasePath, fullLengthTestsBasePath];

    for (const baseDir of directoriesToScan) {
        try {
            // Ensure the directory exists, create if not
            await ensureDirExists(baseDir);

            const files = await fs.readdir(baseDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(baseDir, file);
                try {
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    const testData = JSON.parse(fileContent) as Omit<GeneratedTest, 'testType'>; // Read base data

                    // Add back the testType based on the directory it was read from
                    const testType = baseDir.includes('chapterwise') ? 'chapterwise' : 'full_length';
                    const fullTestData = { ...testData, testType } as GeneratedTest;


                    // Basic validation (check for required fields)
                    if (fullTestData.test_code && fullTestData.name && fullTestData.test_subject && fullTestData.type) {
                         allTests.push(fullTestData);
                    } else {
                        console.warn(`Skipping invalid test file (missing core fields): ${filePath}`);
                    }
                } catch (parseError) {
                    console.error(`Error parsing test file ${filePath}:`, parseError);
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.warn(`Directory not found: ${baseDir}. Skipping.`);
            } else {
                console.error(`Error reading tests from ${baseDir}:`, error);
                // Consider throwing a more specific error if needed by the caller
            }
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
}


/**
 * Deletes a specific generated test JSON file by its test code.
 * Searches in both chapterwise and full_length directories.
 * @param testCode The unique code of the test to delete.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteGeneratedTest(testCode: string): Promise<{ success: boolean; message?: string }> {
    if (!testCode) {
        return { success: false, message: 'Test code is required for deletion.' };
    }

    const possibleDirs = [chapterwiseTestsBasePath, fullLengthTestsBasePath];
    let deleted = false;
    let filePathTried: string | null = null;

    for (const dir of possibleDirs) {
        // Assume filename is simply testCode.json as per save logic
        const filePath = path.join(dir, `${testCode}.json`);
        filePathTried = filePath; // Store last tried path for error message

        try {
            await fs.access(filePath); // Check if file exists
            await fs.unlink(filePath); // Attempt deletion
            console.log(`Deleted generated test file: ${filePath}`);
            deleted = true;
            break; // Stop searching once deleted
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File not found in this directory, continue searching
                continue;
            } else {
                // Other error during deletion
                console.error(`Error deleting generated test ${testCode} from ${filePath}:`, error);
                return { success: false, message: `Failed to delete test ${testCode} from ${dir}. Reason: ${error.message}` };
            }
        }
    }

    if (deleted) {
        return { success: true };
    } else {
         // If loop finishes and not deleted, it wasn't found
         return { success: false, message: `Test file with code ${testCode} not found in any directory.` };
    }
}

// --- TODO: Add functions for updating a generated test if needed ---
// export async function updateGeneratedTest(...) { ... }

/**
 * Fetches a single generated test by its unique test code.
 * Searches in both chapterwise and full_length directories.
 * @param testCode The unique code of the test to fetch.
 * @returns A promise resolving to the GeneratedTest object or null if not found or on error.
 */
export async function getGeneratedTestByCode(testCode: string): Promise<GeneratedTest | null> {
    if (!testCode) {
        console.error('Test code is required to fetch a test.');
        return null;
    }

    const possibleDirs = [chapterwiseTestsBasePath, fullLengthTestsBasePath];

    for (const dir of possibleDirs) {
        const filePath = path.join(dir, `${testCode}.json`);
        try {
            // Check if file exists first
            await fs.access(filePath);

            // Read and parse the file
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const testData = JSON.parse(fileContent) as Omit<GeneratedTest, 'testType'>;

            // Determine test type based on directory
            const testType = dir.includes('chapterwise') ? 'chapterwise' : 'full_length';
            const fullTestData = { ...testData, testType } as GeneratedTest;

            // Basic validation
             if (fullTestData.test_code && fullTestData.name && fullTestData.test_subject && fullTestData.type) {
                  console.log(`Test found: ${testCode} in ${dir}`);
                  return fullTestData;
             } else {
                 console.warn(`Found test file ${filePath} but it's missing core fields.`);
                 // Continue searching in the other directory
             }

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File not found in this directory, continue to the next one
                continue;
            } else {
                // Other error (parsing, reading)
                console.error(`Error accessing or parsing test file ${filePath}:`, error);
                // Return null on significant errors, maybe throw depending on desired behavior
                return null;
            }
        }
    }

    // If the loop finishes without finding the file
    console.log(`Test with code ${testCode} not found in any directory.`);
    return null; // Not found in any directory
}
