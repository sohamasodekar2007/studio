// src/actions/test-report-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { TestSession, GeneratedTest, TestResultSummary, UserProfile, TestQuestion } from '@/types';
import { getUserById } from './user-actions'; // To fetch user details if needed

const reportsBasePath = path.join(process.cwd(), 'src', 'data', 'chapterwise-test-report');

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

// Helper to get all questions from a test definition, regardless of type
function getAllQuestionsFromTest(testDef: GeneratedTest | null): TestQuestion[] {
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
    const allQuestions = getAllQuestionsFromTest(testDef);
     if (allQuestions.length === 0 || !session.answers) {
         console.error(`Cannot calculate results for ${session.testId}: No questions in definition or session answers are missing.`);
         return null; // Cannot calculate results
     }
     if (allQuestions.length !== session.answers.length) {
         console.warn(`Mismatch between questions in definition (${allQuestions.length}) and session answers (${session.answers.length}) for test ${session.testId}. Calculation might be inaccurate.`);
         // Decide how to handle: return null, or proceed with caution? Proceeding cautiously.
     }

    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;
    let totalMarksPossible = 0;
    let score = 0;

    const detailedAnswers = session.answers.map((userAns, index) => {
        const questionDef = allQuestions[index]; // Get the corresponding question definition
        if (!questionDef) {
             console.error(`Definition missing for question index ${index} in test ${session.testId}`);
             // Return a placeholder or skip? Returning placeholder for now.
             return {
                questionIndex: index,
                questionText: 'Error: Question definition missing',
                questionImageUrl: null,
                userAnswer: userAns.selectedOption,
                correctAnswer: 'Error',
                isCorrect: false,
                status: userAns.status,
                explanationText: null,
                explanationImageUrl: null,
             };
        }

        const currentMarks = questionDef.marks || 1; // Default to 1 mark if missing
        totalMarksPossible += currentMarks;
        let isCorrect = false;
        // Ensure correct answer format matches selected option format (e.g., "A", not "Option A")
        const correctAnswerKey = questionDef.answer?.replace('Option ', '').trim();

        if (userAns.selectedOption) {
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
        }

        return {
            questionIndex: index,
            questionText: questionDef.question_text || questionDef.question, // Handle potential MathJax in text
            questionImageUrl: questionDef.question_image_url, // URL relative to /public
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey || 'N/A',
            isCorrect,
            status: userAns.status,
             explanationText: questionDef.explanation_text, // Handle potential MathJax in text
             explanationImageUrl: questionDef.explanation_image_url, // URL relative to /public
        };
    });

    const unansweredCount = Math.max(0, allQuestions.length - attemptedCount); // Ensure non-negative
    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    const endTime = session.endTime || Date.now(); // Use current time if endTime is missing
    const timeTakenSeconds = session.startTime ? Math.max(0, (endTime - session.startTime) / 1000) : 0;
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);

    return {
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
    if (!sessionData || !testDefinition) {
        return { success: false, results: null, message: 'Missing session data or test definition.' };
    }

    try {
        const resultsSummary = calculateResultsInternal(sessionData, testDefinition);
        if (!resultsSummary) {
            throw new Error('Failed to calculate test results.');
        }

        const userReportDir = path.join(reportsBasePath, sessionData.userId);
        await ensureDirExists(userReportDir);

        const filename = `${resultsSummary.testCode}-${resultsSummary.userId}-${resultsSummary.attemptTimestamp}.json`;
        const filePath = path.join(userReportDir, filename);

        await fs.writeFile(filePath, JSON.stringify(resultsSummary, null, 2), 'utf-8');
        console.log(`Test report saved: ${filePath}`);

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

    try {
        await fs.access(filePath); // Check if file exists
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const reportData: TestResultSummary = JSON.parse(fileContent);
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
export async function getAllTestReportsForUser(userId: string): Promise<Partial<TestResultSummary>[]> {
    if (!userId) return [];

    const userReportDir = path.join(reportsBasePath, userId);
    const reports: Partial<TestResultSummary>[] = [];

    try {
        await ensureDirExists(userReportDir); // Ensure directory exists
        const files = await fs.readdir(userReportDir);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file.includes(`-${userId}-`));

        for (const file of jsonFiles) {
            const filePath = path.join(userReportDir, file);
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const reportData: TestResultSummary = JSON.parse(fileContent);
                // Optionally fetch user details here if needed for display, but might be slow
                reports.push(reportData);
            } catch (parseError) {
                console.error(`Error parsing report file ${filePath}:`, parseError);
                // Push partial data or skip? Pushing partial for now.
                reports.push({ attemptId: file.replace('.json', ''), userId });
            }
        }

        // Sort by submission date descending (newest first)
        reports.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));

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

    const allReports: Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null }> = [];

    try {
        await ensureDirExists(reportsBasePath); // Ensure base directory exists
        const userDirs = await fs.readdir(reportsBasePath, { withFileTypes: true });

        for (const userDirEntry of userDirs) {
            if (userDirEntry.isDirectory()) {
                const userId = userDirEntry.name;
                const userReportDir = path.join(reportsBasePath, userId);
                try {
                    const files = await fs.readdir(userReportDir);
                    const relevantFiles = files.filter(file => file.startsWith(`${testCode}-${userId}-`) && file.endsWith('.json'));

                    for (const file of relevantFiles) {
                        const filePath = path.join(userReportDir, file);
                        try {
                            const fileContent = await fs.readFile(filePath, 'utf-8');
                            const reportData: TestResultSummary = JSON.parse(fileContent);
                             // Fetch user profile to include in the result
                            const userProfile = await getUserById(userId);
                            allReports.push({ ...reportData, user: userProfile }); // Add user profile
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
        return allReports;

    } catch (error: any) {
        console.error(`Error scanning report directories for test ${testCode}:`, error);
        return [];
    }
}
