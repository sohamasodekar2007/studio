// src/actions/challenge-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Challenge, ChallengeTestConfig, ChallengeParticipant, TestQuestion, UserProfile, ChallengeInvite, UserChallengeInvites, QuestionBankItem, DifficultyLevel, ExamOption, UserAnswer, DetailedAnswer } from '@/types';
import { getQuestionsForLesson } from './question-bank-query-actions'; // To fetch questions
import { getUserById } from './user-actions'; // To fetch user names

const challengesBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenges');
const challengeInvitesBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenge-invites');
const challengeHistoryBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenge-history');


async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

// Helper to generate unique challenge code
function generateChallengeCode(): string {
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  const part3 = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `CHL-${part1}-${part2}-${part3}`;
}

// Helper to read a specific challenge file
async function readChallengeFile(challengeCode: string): Promise<Challenge | null> {
  const filePath = path.join(challengesBasePath, `${challengeCode}.json`);
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent) as Challenge;
  } catch (error) {
    return null; // Not found or error reading
  }
}

// Helper to write a specific challenge file
async function writeChallengeFile(challenge: Challenge): Promise<boolean> {
  const filePath = path.join(challengesBasePath, `${challenge.challengeCode}.json`);
  try {
    await ensureDirExists(challengesBasePath);
    await fs.writeFile(filePath, JSON.stringify(challenge, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write challenge file ${challenge.challengeCode}:`, error);
    return false;
  }
}

// Helper to read/write user challenge invites
async function getUserInvites(userId: string): Promise<UserChallengeInvites> {
    const filePath = path.join(challengeInvitesBasePath, `${userId}.json`);
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent) as UserChallengeInvites;
    } catch (error) {
        return { userId, invites: [] }; // Default if not found or error
    }
}

async function writeUserInvites(userId: string, invitesData: UserChallengeInvites): Promise<boolean> {
    const filePath = path.join(challengeInvitesBasePath, `${userId}.json`);
    try {
        await ensureDirExists(challengeInvitesBasePath);
        await fs.writeFile(filePath, JSON.stringify(invitesData, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Failed to write invites for user ${userId}:`, error);
        return false;
    }
}


export async function createChallenge(
  creatorId: string,
  creatorName: string | null,
  testConfig: ChallengeTestConfig,
  challengedUserIds: string[]
): Promise<{ success: boolean; message?: string; challengeCode?: string }> {
  try {
    await ensureDirExists(challengesBasePath);
    await ensureDirExists(challengeInvitesBasePath);

    const challengeCode = generateChallengeCode();
    const now = Date.now();
    const expiresAt = now + 3 * 60 * 60 * 1000; // 3 hours from now

    const questionsFromBank = await getQuestionsForLesson({
        subject: testConfig.subject,
        lesson: testConfig.lesson,
        examType: testConfig.examFilter === 'all' ? undefined : testConfig.examFilter,
    });

    if (questionsFromBank.length < testConfig.numQuestions) {
        return { success: false, message: `Not enough questions available in the bank for ${testConfig.subject} - ${testConfig.lesson} (found ${questionsFromBank.length}, need ${testConfig.numQuestions}). Try different filters or add more questions.` };
    }

    const shuffledQuestions = [...questionsFromBank].sort(() => 0.5 - Math.random());
    const selectedBankQuestions = shuffledQuestions.slice(0, testConfig.numQuestions);

    const testQuestions: TestQuestion[] = selectedBankQuestions.map(q => ({
        id: q.id,
        type: q.type,
        question_text: q.question.text || null,
        question_image_url: q.question.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.question.image)}` : null,
        options: [q.options.A, q.options.B, q.options.C, q.options.D],
        answer: q.correct,
        marks: q.marks || 1,
        explanation_text: q.explanation.text || null,
        explanation_image_url: q.explanation.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.explanation.image)}` : null,
    }));


    const participants: Record<string, ChallengeParticipant> = {
      [creatorId]: { userId: creatorId, name: creatorName, status: 'accepted' },
    };
    // Fetch and store names for challenged users
    for (const id of challengedUserIds) {
        const userProfile = await getUserById(id);
        participants[id] = { userId: id, name: userProfile?.name || null, status: 'pending' };
    }

    const newChallenge: Challenge = {
      challengeCode,
      creatorId,
      creatorName,
      participants,
      testConfig,
      testStatus: 'waiting',
      questions: testQuestions,
      createdAt: now,
      expiresAt,
    };

    const saveSuccess = await writeChallengeFile(newChallenge);
    if (!saveSuccess) throw new Error("Failed to save challenge data.");

    const testNameForInvite = `${testConfig.subject} - ${testConfig.lesson} Challenge`;
    for (const challengedId of challengedUserIds) {
        const userInvitesData = await getUserInvites(challengedId);
        userInvitesData.invites.push({
            challengeCode,
            creatorId,
            creatorName,
            testName: testNameForInvite,
            numQuestions: testConfig.numQuestions,
            status: 'pending',
            createdAt: now,
            expiresAt
        });
        await writeUserInvites(challengedId, userInvitesData);
    }

    return { success: true, challengeCode };
  } catch (error: any) {
    console.error("Error creating challenge:", error);
    return { success: false, message: error.message || "Could not create challenge." };
  }
}

export async function getChallengeDetails(challengeCode: string): Promise<Challenge | null> {
    return readChallengeFile(challengeCode);
}

export async function getUserChallengeInvites(userId: string): Promise<UserChallengeInvites> {
    return getUserInvites(userId);
}

export async function acceptChallenge(challengeCode: string, userId: string): Promise<{ success: boolean; message?: string, challenge?: Challenge }> {
    const challenge = await readChallengeFile(challengeCode);
    if (!challenge) return { success: false, message: "Challenge not found or expired." };
    if (challenge.expiresAt < Date.now()) return { success: false, message: "Challenge has expired."};


    if (challenge.participants[userId]) {
        challenge.participants[userId].status = 'accepted';
        // Fetch user's name if not already present or to update it
        const userProfile = await getUserById(userId);
        if (userProfile) {
            challenge.participants[userId].name = userProfile.name;
        } else if (!challenge.participants[userId].name) { // If profile not found and name was null
             challenge.participants[userId].name = `User ${userId.substring(0,6)}`; // Fallback
        }


        const saveSuccess = await writeChallengeFile(challenge);
        if (!saveSuccess) return { success: false, message: "Failed to update challenge status."};

        // Update user's invite status
        const userInvites = await getUserInvites(userId);
        const inviteIndex = userInvites.invites.findIndex(inv => inv.challengeCode === challengeCode);
        if (inviteIndex !== -1) {
            userInvites.invites[inviteIndex].status = 'accepted';
            await writeUserInvites(userId, userInvites);
        }
        return { success: true, challenge };
    }
    return { success: false, message: "User not part of this challenge." };
}

export async function rejectChallenge(challengeCode: string, userId: string): Promise<{ success: boolean; message?: string }> {
     const challenge = await readChallengeFile(challengeCode);
    if (!challenge) return { success: false, message: "Challenge not found or expired." };

    if (challenge.participants[userId]) {
        challenge.participants[userId].status = 'rejected';
        const saveSuccess = await writeChallengeFile(challenge);
         if (!saveSuccess) return { success: false, message: "Failed to update challenge status."};

        // Update user's invite status
        const userInvites = await getUserInvites(userId);
        const inviteIndex = userInvites.invites.findIndex(inv => inv.challengeCode === challengeCode);
        if (inviteIndex !== -1) {
            userInvites.invites[inviteIndex].status = 'rejected';
            await writeUserInvites(userId, userInvites);
        }
        return { success: true };
    }
    return { success: false, message: "User not part of this challenge." };
}


export async function startChallenge(challengeCode: string, creatorId: string): Promise<{ success: boolean; message?: string }> {
    const challenge = await readChallengeFile(challengeCode);
    if (!challenge) return { success: false, message: "Challenge not found." };
    if (challenge.creatorId !== creatorId) return { success: false, message: "Only the creator can start the challenge."};
    if (challenge.testStatus !== 'waiting') return { success: false, message: "Challenge already started or completed."};
    if (challenge.expiresAt < Date.now()) return { success: false, message: "Challenge has expired."};

    const allAccepted = Object.values(challenge.participants)
                            .filter(p => p.userId !== creatorId) 
                            .every(p => p.status === 'accepted');

    if (!allAccepted && Object.values(challenge.participants).filter(p => p.userId !== creatorId).length > 0) { 
        return { success: false, message: "Not all invited participants have accepted the challenge yet." };
    }


    challenge.testStatus = 'started';
    challenge.startedAt = Date.now();
    const saveSuccess = await writeChallengeFile(challenge);
    return { success: saveSuccess, message: saveSuccess ? undefined : "Failed to start challenge."};
}

export async function submitChallengeAttempt(
  challengeCode: string,
  userId: string,
  answers: UserAnswer[],
  timeTakenSeconds: number
): Promise<{ success: boolean; message?: string }> {
  const challenge = await readChallengeFile(challengeCode);
  if (!challenge) return { success: false, message: "Challenge not found." };
  if (challenge.testStatus !== 'started') return { success: false, message: "Challenge not started or already completed/expired."};
  if (challenge.expiresAt < Date.now()) {
      challenge.testStatus = 'expired';
      await writeChallengeFile(challenge);
      return { success: false, message: "Challenge has expired."};
  }


  const participant = challenge.participants[userId];
  if (!participant) return { success: false, message: "You are not part of this challenge."};
  if (participant.status === 'completed') return { success: false, message: "You have already submitted this challenge."};


  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const detailedAnswersForReport: DetailedAnswer[] = [];


  challenge.questions.forEach((q, index) => {
    const userAnswer = answers.find(a => a.questionId === q.id || a.questionId === `q-${index}`); 
    const isCorrect = userAnswer?.selectedOption === q.answer;
    if (userAnswer && userAnswer.selectedOption) {
      if (isCorrect) {
        score += q.marks;
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
  });

  participant.score = score;
  participant.timeTaken = timeTakenSeconds;
  participant.status = 'completed';
  participant.answers = answers; 

  const allCompletedOrRejected = Object.values(challenge.participants).every(p => p.status === 'completed' || p.status === 'rejected');
  if (allCompletedOrRejected) {
    challenge.testStatus = 'completed';
  }

  const saveSuccess = await writeChallengeFile(challenge);
  return { success: saveSuccess, message: saveSuccess ? "Attempt submitted." : "Failed to save attempt." };
}

export async function getChallengeResults(challengeCode: string): Promise<Challenge | null> {
    const challenge = await readChallengeFile(challengeCode);
    if (challenge && (challenge.testStatus === 'completed' || challenge.testStatus === 'expired')) {
        const participantsArray = Object.values(challenge.participants)
            .filter(p => p.status === 'completed') 
            .sort((a, b) => {
                const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
                if (scoreDiff !== 0) return scoreDiff;
                return (a.timeTaken ?? Infinity) - (b.timeTaken ?? Infinity);
            });
        
        participantsArray.forEach((p, index) => {
            if (challenge.participants[p.userId]) {
                 challenge.participants[p.userId].rank = index + 1;
            }
        });
    }
    return challenge;
}
