
// src/actions/generated-test-actions.ts
'use server';

import type { GeneratedTest, ChapterwiseTestJson, FullLengthTestJson, TestQuestion } from '@/types'; // Use specific types
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating unique test codes

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

// Helper function to generate a unique test code
function generateUniqueTestCode(): string {
    // Generates an 8-character alphanumeric code, e.g., "AB12CD34"
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}


/**
 * Saves the generated test definition JSON to the appropriate folder
 * (chapterwise or full_length) based on the test type.
 * The filename will be the unique test_code.
 *
 * @param testDataToSave - The GeneratedTest object containing all test details, EXCLUDING test_code and createdAt (will be generated here).
 * @returns A promise resolving with success status, optional message, and the file path where it was saved.
 */
export async function saveGeneratedTest(
    testDataToSave: Omit<GeneratedTest, 'test_code' | 'createdAt'>
): Promise<{ success: boolean; message?: string; filePath?: string, test_code?: string }> {
    
    const test_code = generateUniqueTestCode();
    const createdAt = new Date().toISOString();

    const fullTestDefinition: GeneratedTest = {
        ...testDataToSave,
        test_code,
        createdAt,
    } as GeneratedTest; // Type assertion after adding generated fields

    let targetDir: string;
    let filename: string;

    // Determine save directory and filename based on test type
    if (fullTestDefinition.testType === 'chapterwise') {
        targetDir = chapterwiseTestsBasePath;
        filename = `${fullTestDefinition.test_code}.json`;
        
        // Ensure 'lesson' is a string for single-lesson, 'lessons' for multi.
        // This is a common source of type issues if not handled carefully.
        const chapterwiseData = fullTestDefinition as ChapterwiseTestJson;
        if (chapterwiseData.lessons && chapterwiseData.lessons.length === 1 && !chapterwiseData.lesson) {
            // If 'lessons' has one item and 'lesson' isn't set, populate 'lesson'
            chapterwiseData.lesson = chapterwiseData.lessons[0];
        } else if (chapterwiseData.lesson && (!chapterwiseData.lessons || chapterwiseData.lessons.length === 0)) {
            // If 'lesson' is set and 'lessons' isn't, populate 'lessons'
            chapterwiseData.lessons = [chapterwiseData.lesson];
        }


    } else if (fullTestDefinition.testType === 'full_length') {
        targetDir = fullLengthTestsBasePath;
        filename = `${fullTestDefinition.test_code}.json`;
    } else {
        console.error('Unknown test type provided to saveGeneratedTest:', (fullTestDefinition as any).testType);
        return { success: false, message: 'Invalid test type provided.' };
    }

    const filePath = path.join(targetDir, filename);

    try {
        await ensureDirExists(targetDir); // Ensure the target directory exists

        // The fullTestDefinition already includes test_code and createdAt
        await fs.writeFile(filePath, JSON.stringify(fullTestDefinition, null, 2), 'utf-8');
        console.log(`Generated test definition saved: ${filePath}`);
        return { success: true, message: `Test ${fullTestDefinition.test_code} saved successfully.`, filePath, test_code: fullTestDefinition.test_code };

    } catch (error: any) {
        console.error(`Error saving generated test definition ${fullTestDefinition.test_code}:`, error);
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
            await ensureDirExists(baseDir);

            const files = await fs.readdir(baseDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(baseDir, file);
                try {
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    // Parse first to determine type, then cast
                    const parsedData = JSON.parse(fileContent);
                    
                    if (!parsedData.testType) {
                         // Try to infer from directory if testType is missing
                         if (baseDir.includes('chapterwise') && !parsedData.testType) parsedData.testType = 'chapterwise';
                         else if (baseDir.includes('full_length') && !parsedData.testType) parsedData.testType = 'full_length';
                    }


                    // Basic validation (check for required fields for either type)
                    if (parsedData.test_code && parsedData.name && parsedData.test_subject && parsedData.type && parsedData.testType) {
                        // Perform specific validations based on inferred/parsed testType
                        if (parsedData.testType === 'chapterwise') {
                            const chapterwiseData = parsedData as ChapterwiseTestJson;
                            // Ensure 'questions' array exists for chapterwise
                            if (!Array.isArray(chapterwiseData.questions)) chapterwiseData.questions = [];
                             // Ensure 'lessons' is an array, and 'lesson' (single) is present if 'lessons' is empty/not there
                            if (!Array.isArray(chapterwiseData.lessons)) {
                                chapterwiseData.lessons = chapterwiseData.lesson ? [chapterwiseData.lesson] : [];
                            }
                            if (chapterwiseData.lessons.length === 0 && chapterwiseData.lesson) {
                                chapterwiseData.lessons = [chapterwiseData.lesson];
                            }


                        } else if (parsedData.testType === 'full_length') {
                            const fullLengthData = parsedData as FullLengthTestJson;
                            // Ensure subject-specific question arrays exist for full-length
                            if (!Array.isArray(fullLengthData.physics_questions)) fullLengthData.physics_questions = [];
                            if (!Array.isArray(fullLengthData.chemistry_questions)) fullLengthData.chemistry_questions = [];
                            if (fullLengthData.stream === 'PCM' && !Array.isArray(fullLengthData.maths_questions)) fullLengthData.maths_questions = [];
                            if (fullLengthData.stream === 'PCB' && !Array.isArray(fullLengthData.biology_questions)) fullLengthData.biology_questions = [];
                        }
                        allTests.push(parsedData as GeneratedTest);
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
            }
        }
    }

    allTests.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
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

    for (const dir of possibleDirs) {
        const filePath = path.join(dir, `${testCode}.json`);
        try {
            await fs.access(filePath); 
            await fs.unlink(filePath); 
            console.log(`Deleted generated test file: ${filePath}`);
            deleted = true;
            break; 
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                continue;
            } else {
                console.error(`Error deleting generated test ${testCode} from ${filePath}:`, error);
                return { success: false, message: `Failed to delete test ${testCode} from ${dir}. Reason: ${error.message}` };
            }
        }
    }

    if (deleted) {
        return { success: true };
    } else {
         return { success: false, message: `Test file with code ${testCode} not found in any directory.` };
    }
}


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
            await fs.access(filePath);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const parsedData = JSON.parse(fileContent);

            if (!parsedData.testType) {
                if (dir.includes('chapterwise')) parsedData.testType = 'chapterwise';
                else if (dir.includes('full_length')) parsedData.testType = 'full_length';
            }
            
            // Validate common fields
            if (parsedData.test_code && parsedData.name && parsedData.test_subject && parsedData.type && parsedData.testType) {
                 // Specific type validation and default empty arrays for question lists
                 if (parsedData.testType === 'chapterwise') {
                    const chapterwiseData = parsedData as ChapterwiseTestJson;
                    if (!Array.isArray(chapterwiseData.questions)) chapterwiseData.questions = [];
                     if (!Array.isArray(chapterwiseData.lessons)) {
                        chapterwiseData.lessons = chapterwiseData.lesson ? [chapterwiseData.lesson] : [];
                    }
                    if (chapterwiseData.lessons.length === 0 && chapterwiseData.lesson) {
                        chapterwiseData.lessons = [chapterwiseData.lesson];
                    }
                } else if (parsedData.testType === 'full_length') {
                    const fullLengthData = parsedData as FullLengthTestJson;
                    if (!Array.isArray(fullLengthData.physics_questions)) fullLengthData.physics_questions = [];
                    if (!Array.isArray(fullLengthData.chemistry_questions)) fullLengthData.chemistry_questions = [];
                    if (fullLengthData.stream === 'PCM' && !Array.isArray(fullLengthData.maths_questions)) fullLengthData.maths_questions = [];
                    if (fullLengthData.stream === 'PCB' && !Array.isArray(fullLengthData.biology_questions)) fullLengthData.biology_questions = [];
                }
                console.log(`Test found: ${testCode} in ${dir}`);
                return parsedData as GeneratedTest;
            } else {
                 console.warn(`Found test file ${filePath} but it's missing core fields.`);
            }

        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error(`Error accessing or parsing test file ${filePath}:`, error);
                // Return null on significant errors, maybe throw depending on desired behavior
                return null;
            }
            // If ENOENT, continue to the next directory
        }
    }

    console.log(`Test with code ${testCode} not found in any directory.`);
    return null;
}
