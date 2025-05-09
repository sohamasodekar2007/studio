// src/actions/challenge-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Challenge, ChallengeTestConfig, ChallengeParticipant, TestQuestion, UserProfile, ChallengeInvite, UserChallengeInvites, QuestionBankItem, DifficultyLevel, ExamOption, UserAnswer, DetailedAnswer, UserChallengeHistory, UserChallengeHistoryItem } from '@/types';
import { getQuestionsForLesson } from './question-bank-query-actions'; // To fetch questions
import { getUserById } from './user-actions'; // To fetch user names

const challengesBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenges');
const challengeInvitesBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenge-invites');
const userChallengeHistoryBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenge-history');


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
  const part3 = Math.random().toString(36).substring(2, 6).toUpperCase(); // Increased length for uniqueness
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

// --- User Challenge History Actions ---
async function getUserChallengeHistory(userId: string): Promise<UserChallengeHistory> {
  const filePath = path.join(userChallengeHistoryBasePath, `${userId}.json`);
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent) as UserChallengeHistory;
  } catch (error) {
    return { userId, completedChallenges: [] };
  }
}

async function writeUserChallengeHistory(userId: string, historyData: UserChallengeHistory): Promise<boolean> {
  const filePath = path.join(userChallengeHistoryBasePath, `${userId}.json`);
  try {
    await ensureDirExists(userChallengeHistoryBasePath);
    await fs.writeFile(filePath, JSON.stringify(historyData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write challenge history for user ${userId}:`, error);
    return false;
  }
}

export async function addChallengeToUserHistory(userId: string, challenge: Challenge, participantData: ChallengeParticipant): Promise<boolean> {
    const history = await getUserChallengeHistory(userId);
    const opponentNames = Object.values(challenge.participants)
                                .filter(p => p.userId !== userId && p.status === 'completed') // Consider only completed opponents
                                .map(p => p.name);

    const historyItem: UserChallengeHistoryItem = {
        challengeCode: challenge.challengeCode,
        testName: `${challenge.testConfig.subject} - ${challenge.testConfig.lesson}`,
        creatorName: challenge.creatorName,
        opponentNames: opponentNames,
        userScore: participantData.score || 0,
        totalPossibleScore: challenge.questions.reduce((sum, q) => sum + q.marks, 0),
        rank: participantData.rank,
        totalParticipants: Object.values(challenge.participants).filter(p => p.status === 'completed').length,
        completedAt: Date.now(), // Timestamp of adding to history
    };

    // Avoid duplicates if already added
    const existingEntryIndex = history.completedChallenges.findIndex(c => c.challengeCode === challenge.challengeCode);
    if (existingEntryIndex !== -1) {
        history.completedChallenges[existingEntryIndex] = historyItem; // Update if exists
    } else {
        history.completedChallenges.unshift(historyItem); // Add to beginning
    }
    
    return writeUserChallengeHistory(userId, history);
}

export async function getCompletedChallengesForUser(userId: string): Promise<UserChallengeHistoryItem[]> {
    const history = await getUserChallengeHistory(userId);
    return history.completedChallenges.sort((a, b) => b.completedAt - a.completedAt); // Newest first
}
// --- End User Challenge History Actions ---


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
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes from now

    const questionsFromBank = await getQuestionsForLesson({
        subject: testConfig.subject,
        lesson: testConfig.lesson,
        examType: testConfig.examFilter === 'all' ? undefined : testConfig.examFilter,
        // Add difficulty filter if present in testConfig
        difficulty: testConfig.difficulty === 'all' ? undefined : testConfig.difficulty,
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
      [creatorId]: { userId: creatorId, name: creatorName, status: 'accepted', avatarUrl: (await getUserById(creatorId))?.avatarUrl },
    };
    
    for (const id of challengedUserIds) {
        const userProfile = await getUserById(id);
        participants[id] = { userId: id, name: userProfile?.name || null, status: 'pending', avatarUrl: userProfile?.avatarUrl };
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
        const userProfile = await getUserById(userId);
        if (userProfile) {
            challenge.participants[userId].name = userProfile.name;
            challenge.participants[userId].avatarUrl = userProfile.avatarUrl;
        } else if (!challenge.participants[userId].name) { 
             challenge.participants[userId].name = `User ${userId.substring(0,6)}`; 
        }

        const saveSuccess = await writeChallengeFile(challenge);
        if (!saveSuccess) return { success: false, message: "Failed to update challenge status."};

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

    const acceptedParticipants = Object.values(challenge.participants).filter(p => p.status === 'accepted');
    if (acceptedParticipants.length === 0 && Object.keys(challenge.participants).length > 1) { // If only creator accepted & others invited
        return { success: false, message: "No invited participants have accepted the challenge yet." };
    }
    // Allow starting if at least one other person accepted, or if it's a solo challenge (only creator)
    // The original logic for `allAccepted` was fine:
    const allInvitedAcceptedOrCreatorIsSolo = Object.values(challenge.participants)
        .filter(p => p.userId !== creatorId) 
        .every(p => p.status === 'accepted' || p.status === 'rejected'); // Consider rejected as "responded"

    // If there are invited users, and not all have accepted (and not rejected), don't start.
    const invitedUsers = Object.values(challenge.participants).filter(p => p.userId !== creatorId);
    const pendingInvitedUsers = invitedUsers.filter(p => p.status === 'pending');

    if (invitedUsers.length > 0 && pendingInvitedUsers.length > 0) {
         return { success: false, message: "Not all invited participants have responded to the challenge yet." };
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
): Promise<{ success: boolean; message?: string, challenge?: Challenge }> {
  const challenge = await readChallengeFile(challengeCode);
  if (!challenge) return { success: false, message: "Challenge not found." };
  if (challenge.testStatus !== 'started') return { success: false, message: "Challenge not started or already completed/expired."};
  
  if (challenge.expiresAt < Date.now() && challenge.testStatus !== 'completed') {
      challenge.testStatus = 'expired';
      await writeChallengeFile(challenge);
      return { success: false, message: "Challenge has expired."};
  }

  const participant = challenge.participants[userId];
  if (!participant) return { success: false, message: "You are not part of this challenge."};
  if (participant.status === 'completed') return { success: false, message: "You have already submitted this challenge."};

  let score = 0;
  challenge.questions.forEach((q, index) => {
    const userAnswer = answers.find(a => a.questionId === q.id); 
    if (userAnswer && userAnswer.selectedOption) {
      if (userAnswer.selectedOption === q.answer) {
        score += q.marks;
      }
    }
  });

  participant.score = score;
  participant.timeTaken = timeTakenSeconds;
  participant.status = 'completed';
  participant.answers = answers; 

  // After attempt, add to user's challenge history
  await addChallengeToUserHistory(userId, challenge, participant);

  const allCompletedOrRejectedOrExpired = Object.values(challenge.participants).every(
      p => p.status === 'completed' || p.status === 'rejected' || challenge.expiresAt < Date.now()
  );

  if (allCompletedOrRejectedOrExpired && challenge.testStatus !== 'expired') {
    challenge.testStatus = 'completed';
  }

  const saveSuccess = await writeChallengeFile(challenge);
  return { success: saveSuccess, message: saveSuccess ? "Attempt submitted." : "Failed to save attempt.", challenge };
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
        // Update the file with ranks (optional, or do it on demand)
        // await writeChallengeFile(challenge); 
    }
    return challenge;
}

