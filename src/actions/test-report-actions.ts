// src/actions/test-report-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { TestSession, GeneratedTest, TestResultSummary, UserProfile, TestQuestion, QuestionStatus } from '@/types';
import { getUserById } from './user-actions'; // To fetch user details if needed
import { QuestionStatus as QuestionStatusEnum } from '@/types'; // Import enum
import { updateUserPoints } from './points-actions'; // Import points action

const reportsBasePath = path.join(process.cwd(), 'src', 'data', 'chapterwise-test-report');

// --- Point System Constants ---
const POINTS_BASE_TEST = 5; // Base points for attempting a test
const POINTS_PER_CORRECT = 1; // Points per correct answer
const POINTS_PER_INCORRECT = 0; // Points per incorrect answer (can be negative)
const POINTS_BONUS_THRESHOLD_PERCENT = 75; // Score threshold for bonus points
const POINTS_BONUS_AMOUNT = 10; // Bonus points amount

/**
 * Calculates points earned for a given test result.
 * @param results The calculated TestResultSummary.
 * @returns The number of points earned for this test attempt.
 */
function calculatePointsForTest(results: TestResultSummary): number {
    let points = POINTS_BASE_TEST; // Start with base points for attempt
    points += results.correct * POINTS_PER_CORRECT;
    points += results.incorrect * POINTS_PER_INCORRECT;

    // Add bonus points if percentage is above threshold
    if (results.percentage >= POINTS_BONUS_THRESHOLD_PERCENT) {
        points += POINTS_BONUS_AMOUNT;
    }

    // Ensure points are not negative (optional, based on requirements)
    return Math.max(0, points);
}

// Helper function to ensure directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
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
    if (testDef.testseriesType === 'chapterwise' && testDef.questions) { // Renamed from testType
        return testDef.questions;
    } else if (testDef.testseriesType === 'full_length') { // Renamed from testType
        const physics = testDef.physics_questions || []; // Use correct field names
        const chemistry = testDef.chemistry_questions || [];
        const maths = testDef.maths_questions || [];
        const biology = testDef.biology_questions || [];
        return [...physics, ...chemistry, ...maths, ...biology].filter(q => q); // filter out undefined/null
    }
    return [];
}

// Helper: Calculate results - returns the full TestResultSummary
function calculateResultsInternal(session: TestSession, testDef: GeneratedTest): TestResultSummary | null {
    const allQuestions = getAllQuestionsFromTestDefinition(testDef);
     if (allQuestions.length === 0) {
         console.error(`Cannot calculate results for ${session.testId}: No questions in definition.`);
         return null;
     }
      if (!session.answers) {
         console.error(`Cannot calculate results for ${session.testId}: Session answers are missing.`);
         return null;
     }

    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;
    let unansweredCount = 0;
    let totalMarksPossible = 0;
    let score = 0;

    const detailedAnswers = session.answers.map((userAns, index) => {
        const questionDef = allQuestions[index];
        if (!questionDef) {
             console.error(`Definition missing for question index ${index} in test ${session.testId}. Skipping calculation for this question.`);
             return {
                questionId: userAns.questionId,
                questionIndex: index,
                questionText: 'Error: Question definition missing',
                questionImageUrl: null,
                options: [],
                userAnswer: userAns.selectedOption,
                correctAnswer: 'Error',
                isCorrect: false,
                status: userAns.status || QuestionStatusEnum.NotVisited,
                explanationText: null,
                explanationImageUrl: null,
                marks: 0,
             };
        }

        const currentMarks = questionDef.marks || 1;
        totalMarksPossible += currentMarks;
        let isCorrect = false;
        const correctAnswerKey = (questionDef.answer || 'N/A').replace('Option ', '').trim();
        const status = userAns.status || QuestionStatusEnum.NotVisited;

        if (status === QuestionStatusEnum.Answered || status === QuestionStatusEnum.AnsweredAndMarked) {
            attemptedCount++;
             if (userAns.selectedOption === correctAnswerKey) {
                isCorrect = true;
                correctCount++;
                score += currentMarks;
            } else {
                incorrectCount++;
            }
        } else {
            unansweredCount++;
        }
        
        const qImageUrl = questionDef.question_image_url || null;
        
        const qDefExplText = questionDef.explanation_text || null;
        const qDefExplImageUrl = questionDef.explanation_image_url || null;

        let finalExplanationText: string | null = null;
        let finalExplanationImageUrl: string | null = null;

        if (qDefExplImageUrl) {
            finalExplanationImageUrl = qDefExplImageUrl.trim();
            if (qDefExplText && qDefExplText.trim() !== finalExplanationImageUrl) {
                 finalExplanationText = qDefExplText.trim();
            }
        } else if (qDefExplText) {
            const trimmedText = qDefExplText.trim();
            if (trimmedText.startsWith('/') && (trimmedText.endsWith('.png') || trimmedText.endsWith('.jpg') || trimmedText.endsWith('.jpeg') || trimmedText.endsWith('.webp'))) {
                finalExplanationImageUrl = trimmedText; 
            } else {
                finalExplanationText = trimmedText; 
            }
        }


        let questionTextForDetailedAnswer: string | null = null;
        if (questionDef.type === 'text') {
            questionTextForDetailedAnswer = questionDef.question_text || questionDef.question || null;
        } else if (questionDef.type === 'image') {
            questionTextForDetailedAnswer = null;
        } else {
            questionTextForDetailedAnswer = questionDef.question_text || questionDef.question || null;
        }
        

        return {
            questionId: questionDef.id || `q-${index}`,
            questionIndex: index,
            questionText: questionTextForDetailedAnswer,
            questionImageUrl: qImageUrl,
            options: questionDef.options || [],
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey,
            isCorrect,
            status: status,
            explanationText: finalExplanationText,
            explanationImageUrl: finalExplanationImageUrl,
            marks: currentMarks,
        };
    });

    const calculatedUnanswered = allQuestions.length - correctCount - incorrectCount;
    if (calculatedUnanswered !== unansweredCount) {
        unansweredCount = calculatedUnanswered;
    }
    attemptedCount = correctCount + incorrectCount;

    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    const endTime = session.endTime || Date.now();
    const timeTakenSeconds = session.startTime ? Math.max(0, (endTime - session.startTime) / 1000) : 0;
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);

    const summary: TestResultSummary = {
        testCode: session.testId,
        userId: session.userId,
        testName: testDef.name,
        attemptTimestamp: session.startTime,
        submittedAt: endTime,
        duration: testDef.duration,
        totalQuestions: allQuestions.length,
        attempted: attemptedCount,
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        score: score,
        totalMarks: totalMarksPossible,
        percentage: percentage,
        timeTakenMinutes,
        detailedAnswers,
    };
    return summary;
}


/**
 * Calculates results, awards points, and saves the full test report to a JSON file.
 * The report is stored in `src/data/chapterwise-test-report/{userId}/{testCode}-{userId}-{startTime}.json`.
 *
 * @param sessionData - The raw data from the completed test session.
 * @param testDefinition - The definition of the test that was taken.
 * @returns Promise resolving with success status, the calculated results summary (including points), and file path.
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

        const pointsEarned = calculatePointsForTest(resultsSummary);
        resultsSummary.pointsEarned = pointsEarned;

        try {
            await updateUserPoints(sessionData.userId, pointsEarned);
        } catch (pointsError: any) {
            console.error(`Failed to update total points for user ${sessionData.userId} after test ${sessionData.testId}:`, pointsError);
        }

        const userReportDir = path.join(reportsBasePath, sessionData.userId);
        await ensureDirExists(userReportDir);

        const filename = `${resultsSummary.testCode}-${resultsSummary.userId}-${resultsSummary.attemptTimestamp}.json`;
        const filePath = path.join(userReportDir, filename);
        console.log(`Attempting to save report (with points) to: ${filePath}`);

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
    attemptTimestamp: number | string // Can be number or string from URL
): Promise<TestResultSummary | null> {
    if (!userId || !testCode || !attemptTimestamp) {
        console.error("Missing parameters for getTestReport");
        return null;
    }

    const timestampStr = typeof attemptTimestamp === 'number' ? attemptTimestamp.toString() : attemptTimestamp;

    const filename = `${testCode}-${userId}-${timestampStr}.json`;
    const filePath = path.join(reportsBasePath, userId, filename);

    try {
        await fs.access(filePath); 
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
export async function getAllTestReportsForUser(userId: string): Promise<Array<Partial<TestResultSummary> & { attemptTimestamp: number }>> {
    if (!userId) return [];

    const userReportDir = path.join(reportsBasePath, userId);
    const reports: Array<Partial<TestResultSummary> & { attemptTimestamp: number }> = [];

    try {
        await ensureDirExists(userReportDir);
        const files = await fs.readdir(userReportDir);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file.includes(`-${userId}-`));

        for (const file of jsonFiles) {
            const filePath = path.join(userReportDir, file);
            const parts = file.replace('.json', '').split('-');
            const timestampStr = parts[parts.length - 1]; 
            const timestamp = parseInt(timestampStr, 10);

            if (isNaN(timestamp)) {
                console.warn(`Could not parse timestamp from filename: ${file}. Skipping.`);
                continue; 
            }

            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const reportData: TestResultSummary = JSON.parse(fileContent);
                reports.push({ ...reportData, attemptTimestamp: timestamp });
            } catch (parseError) {
                console.error(`Error parsing report file ${filePath}:`, parseError);
                const testCodeFromFile = parts[0]; 
                reports.push({ testCode: testCodeFromFile, userId, attemptTimestamp: timestamp });
            }
        }
        reports.sort((a, b) => (b.attemptTimestamp ?? 0) - (a.attemptTimestamp ?? 0));
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
        await ensureDirExists(reportsBasePath);
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
                            const userProfile = await getUserById(userId); 
                            allReports.push({ ...reportData, user: userProfile });
                        } catch (parseError) {
                            console.error(`Error parsing report file ${filePath}:`, parseError);
                        }
                    }
                } catch (readDirError: any) {
                    if (readDirError.code !== 'ENOENT') {
                         console.error(`Error reading directory ${userReportDir}:`, readDirError);
                    }
                }
            }
        }
        return allReports;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Base report directory not found: ${reportsBasePath}. Returning empty array.`);
            return [];
        }
        console.error(`Error scanning report directories for test ${testCode}:`, error);
        return []; 
    }
}
