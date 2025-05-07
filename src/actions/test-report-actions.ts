// src/actions/test-report-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { TestSession, GeneratedTest, TestResultSummary, UserProfile, TestQuestion, QuestionStatus } from '@/types';
import { getUserById } from './user-actions'; // To fetch user details if needed
import { QuestionStatus as QuestionStatusEnum } from '@/types'; // Import enum

const reportsBasePath = path.join(process.cwd(), 'src', 'data', 'chapterwise-test-report');

// Helper function to ensure directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Directory ensured: ${dirPath}`);
    } catch (error: any) {
        if (error.code !== 'EEXIST') {
            console.error(`Error ensuring directory exists ${dirPath}:`, error);
            throw error; // Re-throw if error is not "directory already exists"
        }
    }
}

// Helper to get all questions from a test definition, regardless of type
function getAllQuestionsFromTestDefinition(testDef: GeneratedTest | null): TestQuestion[] {
    if (!testDef) return [];
    if (testDef.testType === 'chapterwise' && testDef.questions) {
        return testDef.questions;
    } else if (testDef.testType === 'full_length') {
        const physics = testDef.physics || [];
        const chemistry = testDef.chemistry || [];
        const maths = testDef.maths || [];
        const biology = testDef.biology || [];
        return [...physics, ...chemistry, ...maths, ...biology].filter(q => q); // filter out undefined/null
    }
    return [];
}

// Helper: Calculate results - returns the full TestResultSummary
function calculateResultsInternal(session: TestSession, testDef: GeneratedTest): TestResultSummary | null {
    console.log("Calculating results for session:", session.testId, "User:", session.userId);
    const allQuestions = getAllQuestionsFromTestDefinition(testDef);
     if (allQuestions.length === 0) {
         console.error(`Cannot calculate results for ${session.testId}: No questions in definition.`);
         return null; // Cannot calculate results if definition has no questions
     }
      if (!session.answers) {
         console.error(`Cannot calculate results for ${session.testId}: Session answers are missing.`);
         return null; // Cannot calculate results if answers are missing
     }

    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;
    let unansweredCount = 0; // Initialize unanswered count
    let totalMarksPossible = 0;
    let score = 0;

    const detailedAnswers = session.answers.map((userAns, index) => {
        const questionDef = allQuestions[index]; // Get the corresponding question definition
        if (!questionDef) {
             console.error(`Definition missing for question index ${index} in test ${session.testId}. Skipping calculation for this question.`);
             // Skip this question if definition is missing, adjust totalQs later if needed, or handle differently
             // Returning a placeholder to maintain array length, but it won't affect counts/score
             return {
                questionIndex: index,
                questionText: 'Error: Question definition missing',
                questionImageUrl: null,
                userAnswer: userAns.selectedOption,
                correctAnswer: 'Error',
                isCorrect: false,
                status: userAns.status || QuestionStatusEnum.NotVisited, // Use provided status or default
                explanationText: null,
                explanationImageUrl: null,
             };
        }

        const currentMarks = questionDef.marks || 1; // Default to 1 mark if missing
        totalMarksPossible += currentMarks;
        let isCorrect = false;
        // Ensure correct answer format matches selected option format (e.g., "A", not "Option A")
        // Handle potential undefined answer by defaulting to 'N/A'
        const correctAnswerKey = (questionDef.answer || 'N/A').replace('Option ', '').trim();

        // Check status from userAns
        const status = userAns.status || QuestionStatusEnum.NotVisited; // Default if status missing

        if (status === QuestionStatusEnum.Answered || status === QuestionStatusEnum.AnsweredAndMarked) {
            attemptedCount++;
             if (userAns.selectedOption === correctAnswerKey) {
                isCorrect = true;
                correctCount++;
                score += currentMarks;
            } else {
                incorrectCount++;
                // Handle negative marking if applicable (assuming no negative marking for now)
                // score -= (testDef.negativeMarks || 0);
            }
        } else if (status === QuestionStatusEnum.Unanswered || status === QuestionStatusEnum.MarkedForReview || status === QuestionStatusEnum.NotVisited) {
            // Count these as unanswered for the summary, even if marked
            unansweredCount++;
        }

        return {
            questionIndex: index,
            // Ensure we have text or image URL from the definition
            questionText: questionDef.question_text || null, // Use explicit property
            questionImageUrl: questionDef.question_image_url || null, // Use explicit property
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey,
            isCorrect,
            status: status,
             // Ensure we get explanation text or image URL
             explanationText: questionDef.explanation_text || null, // Use explicit property
             explanationImageUrl: questionDef.explanation_image_url || null, // Use explicit property
        };
    });

    // Final calculation for unanswered, ensure total matches
    // Recalculate unanswered based on counts to ensure consistency
    const calculatedUnanswered = allQuestions.length - correctCount - incorrectCount;
    if (calculatedUnanswered !== unansweredCount) {
        console.warn(`Mismatch in unanswered count calculation for test ${session.testId}. Calculated: ${calculatedUnanswered}, Tracked: ${unansweredCount}. Using calculated value.`);
        unansweredCount = calculatedUnanswered;
    }
    attemptedCount = correctCount + incorrectCount; // Ensure attempted is accurate

    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    const endTime = session.endTime || Date.now(); // Use current time if endTime is missing
    const timeTakenSeconds = session.startTime ? Math.max(0, (endTime - session.startTime) / 1000) : 0;
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);

    const summary: TestResultSummary = {
        testCode: session.testId,
        userId: session.userId,
        testName: testDef.name,
        attemptTimestamp: session.startTime, // Use startTime as the unique attempt ID
        submittedAt: endTime,
        duration: testDef.duration,
        totalQuestions: allQuestions.length,
        attempted: attemptedCount,
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        score: score,
        totalMarks: totalMarksPossible, // Include total possible marks
        percentage: percentage,
        timeTakenMinutes,
        detailedAnswers,
    };
    console.log("Calculated results summary:", summary);
    return summary;
}


/**
 * Calculates results and saves the full test report to a JSON file.
 * The report is stored in `src/data/chapterwise-test-report/{userId}/{testCode}-{userId}-{startTime}.json`.
 *
 * @param sessionData - The raw data from the completed test session.
 * @param testDefinition - The definition of the test that was taken.
 * @returns Promise resolving with success status, the calculated results summary, and file path.
 */
export async function saveTestReport(
    sessionData: TestSession,
    testDefinition: GeneratedTest
): Promise<{ success: boolean; results: TestResultSummary | null; filePath?: string; message?: string }> {
    console.log(`saveTestReport called for user ${sessionData.userId}, test ${sessionData.testId}`);
    if (!sessionData || !testDefinition) {
        console.error("saveTestReport error: Missing session data or test definition.");
        return { success: false, results: null, message: 'Missing session data or test definition.' };
    }
     if (!sessionData.startTime) {
        console.error("saveTestReport error: Missing startTime in session data.");
        return { success: false, results: null, message: 'Missing start time in session data.' };
    }

    try {
        const resultsSummary = calculateResultsInternal(sessionData, testDefinition);
        if (!resultsSummary) {
            throw new Error('Failed to calculate test results.');
        }

        const userReportDir = path.join(reportsBasePath, sessionData.userId);
        await ensureDirExists(userReportDir); // Ensure user-specific directory exists

        // Use attemptTimestamp (which is startTime) for the unique filename part
        const filename = `${resultsSummary.testCode}-${resultsSummary.userId}-${resultsSummary.attemptTimestamp}.json`;
        const filePath = path.join(userReportDir, filename);
        console.log(`Attempting to save report to: ${filePath}`);

        await fs.writeFile(filePath, JSON.stringify(resultsSummary, null, 2), 'utf-8');
        console.log(`Test report saved successfully: ${filePath}`);

        return { success: true, results: resultsSummary, filePath };

    } catch (error: any) {
        console.error(`Error saving test report for user ${sessionData.userId}, test ${sessionData.testId}:`, error);
        return { success: false, results: null, message: `Failed to save test report. Reason: ${error.message}` };
    }
}

/**
 * Retrieves a specific test report JSON file.
 *
 * @param userId - The ID of the user.
 * @param testCode - The code of the test.
 * @param attemptTimestamp - The timestamp (startTime) identifying the specific attempt.
 * @returns Promise resolving to the TestResultSummary object or null if not found/error.
 */
export async function getTestReport(
    userId: string,
    testCode: string,
    attemptTimestamp: number | string // Accept number or string
): Promise<TestResultSummary | null> {
    if (!userId || !testCode || !attemptTimestamp) {
        console.error("Missing parameters for getTestReport");
        return null;
    }

    // Ensure attemptTimestamp is a string for filename consistency if passed as number
    const timestampStr = typeof attemptTimestamp === 'number' ? attemptTimestamp.toString() : attemptTimestamp;

    const filename = `${testCode}-${userId}-${timestampStr}.json`;
    const filePath = path.join(reportsBasePath, userId, filename);
    console.log(`Attempting to read report from: ${filePath}`);

    try {
        await fs.access(filePath); // Check if file exists
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const reportData: TestResultSummary = JSON.parse(fileContent);
         console.log(`Report found and parsed for attempt ${timestampStr}`);
        return reportData;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Test report file not found: ${filePath}`);
        } else {
            console.error(`Error reading test report ${filePath}:`, error);
        }
        return null;
    }
}

/**
 * Retrieves all test report summaries for a specific user.
 *
 * @param userId - The ID of the user.
 * @returns Promise resolving to an array of TestResultSummary objects (potentially partial if file parse fails), sorted newest first.
 */
export async function getAllTestReportsForUser(userId: string): Promise<Array<Partial<TestResultSummary> & { attemptTimestamp: number }>> { // Ensure attemptTimestamp is returned
    if (!userId) return [];
    console.log(`Fetching all reports for user: ${userId}`);

    const userReportDir = path.join(reportsBasePath, userId);
    // State holds partial summaries as some data might be missing if parsing failed on backend
    const reports: Array<Partial<TestResultSummary> & { attemptTimestamp: number }> = [];

    try {
        await ensureDirExists(userReportDir); // Ensure directory exists
        const files = await fs.readdir(userReportDir);
        // Filename format: {testCode}-{userId}-{startTime}.json
        const jsonFiles = files.filter(file => file.endsWith('.json') && file.includes(`-${userId}-`));
        console.log(`Found ${jsonFiles.length} potential report files for user ${userId}.`);

        for (const file of jsonFiles) {
            const filePath = path.join(userReportDir, file);
            // Extract timestamp from filename
            const parts = file.replace('.json', '').split('-');
            const timestampStr = parts[parts.length - 1]; // Last part should be the timestamp
            const timestamp = parseInt(timestampStr, 10);

            if (isNaN(timestamp)) {
                console.warn(`Could not parse timestamp from filename: ${file}. Skipping.`);
                continue;
            }

            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const reportData: TestResultSummary = JSON.parse(fileContent);
                // Add the parsed timestamp back to the object
                reports.push({ ...reportData, attemptTimestamp: timestamp });
            } catch (parseError) {
                console.error(`Error parsing report file ${filePath}:`, parseError);
                // Push partial data or skip? Pushing partial with timestamp for identification.
                const parts = file.replace('.json','').split('-');
                reports.push({ testCode: parts[0], userId, attemptTimestamp: timestamp });
            }
        }

        // Sort by attemptTimestamp descending (newest first)
        reports.sort((a, b) => (b.attemptTimestamp ?? 0) - (a.attemptTimestamp ?? 0));

         console.log(`Returning ${reports.length} processed reports for user ${userId}.`);
        return reports;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`No report directory found for user ${userId}.`);
        } else {
            console.error(`Error reading reports for user ${userId}:`, error);
        }
        return [];
    }
}


/**
 * Retrieves all test report summaries for a specific test, across all users.
 * Includes user profile information for ranking.
 *
 * @param testCode - The code of the test.
 * @returns Promise resolving to an array of TestResultSummary objects with user details.
 */
export async function getAllReportsForTest(testCode: string): Promise<Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null }>> {
    if (!testCode) return [];
    console.log(`Fetching all reports for test code: ${testCode}`);

    const allReports: Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null }> = [];

    try {
        await ensureDirExists(reportsBasePath); // Ensure base directory exists
        const userDirs = await fs.readdir(reportsBasePath, { withFileTypes: true });
        console.log(`Scanning ${userDirs.length} directories in ${reportsBasePath}`);

        for (const userDirEntry of userDirs) {
            if (userDirEntry.isDirectory()) {
                const userId = userDirEntry.name;
                const userReportDir = path.join(reportsBasePath, userId);
                try {
                    const files = await fs.readdir(userReportDir);
                    // Filter for files matching the pattern: {testCode}-{userId}-{timestamp}.json
                    const relevantFiles = files.filter(file => file.startsWith(`${testCode}-${userId}-`) && file.endsWith('.json'));

                    for (const file of relevantFiles) {
                        const filePath = path.join(userReportDir, file);
                        try {
                            const fileContent = await fs.readFile(filePath, 'utf-8');
                            const reportData: TestResultSummary = JSON.parse(fileContent);
                             // Fetch user profile to include in the result
                            const userProfile = await getUserById(userId); // getUserById returns Omit<UserProfile, 'password'>
                            allReports.push({ ...reportData, user: userProfile }); // Add user profile (can be null if user deleted)
                        } catch (parseError) {
                            console.error(`Error parsing report file ${filePath}:`, parseError);
                        }
                    }
                } catch (readDirError: any) {
                    if (readDirError.code !== 'ENOENT') {
                         console.error(`Error reading directory ${userReportDir}:`, readDirError);
                    }
                    // Continue to next user directory if one fails
                }
            }
        }
        console.log(`Found ${allReports.length} total reports for test ${testCode}.`);
        return allReports;

    } catch (error: any) {
        console.error(`Error scanning report directories for test ${testCode}:`, error);
        return [];
    }
}
