// src/actions/user-challenge-history-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserChallengeHistory, UserChallengeHistoryItem, Challenge, ChallengeParticipant } from '@/types';

const userChallengeHistoryBasePath = path.join(process.cwd(), 'src', 'data', 'user-challenge-history');

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

export async function getUserChallengeHistory(userId: string): Promise<UserChallengeHistory> {
  const filePath = path.join(userChallengeHistoryBasePath, `${userId}.json`);
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent) as UserChallengeHistory;
  } catch (error) {
    // If file doesn't exist or error, return default structure
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

export async function addChallengeToUserHistory(
    userId: string,
    challenge: Challenge,
    participantData: ChallengeParticipant // The specific participant's data from the challenge
): Promise<boolean> {
    const history = await getUserChallengeHistory(userId);

    const opponentNames = Object.values(challenge.participants)
                                .filter(p => p.userId !== userId && p.status === 'completed') 
                                .map(p => p.name);
    
    const totalPossibleScore = challenge.questions.reduce((sum, q) => sum + (q.marks || 0), 0);

    const historyItem: UserChallengeHistoryItem = {
        challengeCode: challenge.challengeCode,
        testName: `${challenge.testConfig.subject} - ${challenge.testConfig.lesson}`,
        creatorName: challenge.creatorName,
        opponentNames: opponentNames,
        userScore: participantData.score || 0,
        totalPossibleScore: totalPossibleScore,
        rank: participantData.rank, // Rank should be assigned after all users complete or by getChallengeResults
        totalParticipants: Object.values(challenge.participants).filter(p => p.status === 'completed').length,
        completedAt: Date.now(), 
    };

    // Check if this challenge attempt is already in history to avoid duplicates or to update it
    const existingEntryIndex = history.completedChallenges.findIndex(c => c.challengeCode === challenge.challengeCode);
    if (existingEntryIndex !== -1) {
        history.completedChallenges[existingEntryIndex] = historyItem; // Update existing entry
    } else {
        history.completedChallenges.unshift(historyItem); // Add as newest entry
    }
    
    return writeUserChallengeHistory(userId, history);
}


export async function getCompletedChallengesForUser(userId: string): Promise<UserChallengeHistoryItem[]> {
    const history = await getUserChallengeHistory(userId);
    // Sort by completion date, newest first
    return history.completedChallenges.sort((a, b) => b.completedAt - a.completedAt);
}
