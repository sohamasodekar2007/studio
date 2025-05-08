// src/actions/points-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserProfile } from '@/types'; // To potentially read user data for leaderboard display
import { readUsers } from './user-actions'; // Import readUsers to get all users

// Define the structure for storing user points
export interface UserPoints {
    userId: string;
    totalPoints: number;
    lastUpdated: string; // ISO timestamp
    // Add more fields as needed, e.g., points breakdown
    // weeklyPoints?: Record<string, number>; // Example: points per week
    // monthlyPoints?: Record<string, number>;
}

const pointsBasePath = path.join(process.cwd(), 'src', 'data', 'user-points');

/**
 * Helper function to ensure directory exists, creating it recursively if necessary.
 * @param dirPath The path of the directory to ensure exists.
 */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error; // Re-throw if error is not "directory already exists"
    }
  }
}

/**
 * Reads the points data for a specific user.
 * Returns default points object if file doesn't exist.
 * @param userId The ID of the user.
 * @returns A promise resolving to the UserPoints object.
 */
export async function getUserPoints(userId: string): Promise<UserPoints> {
  if (!userId) {
    throw new Error("User ID is required to get points.");
  }
  const filePath = path.join(pointsBasePath, `${userId}.json`);
  const defaultPoints: UserPoints = {
    userId,
    totalPoints: 0,
    lastUpdated: new Date(0).toISOString(), // Default to epoch if no data
  };

  try {
    await ensureDirExists(pointsBasePath); // Ensure base directory exists
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const pointsData = JSON.parse(fileContent) as UserPoints;
    // Basic validation or merging with defaults if needed
    return { ...defaultPoints, ...pointsData };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default points
      return defaultPoints;
    }
    console.error(`Error reading points file for user ${userId}:`, error);
    // Return default on other errors to avoid breaking things, but log it
    return defaultPoints;
  }
}

/**
 * Adds points to a user's total and updates the points file.
 * @param userId The ID of the user.
 * @param pointsToAdd The number of points to add (can be negative).
 * @returns A promise resolving to the updated UserPoints object.
 */
export async function updateUserPoints(userId: string, pointsToAdd: number): Promise<UserPoints> {
  if (!userId) {
    throw new Error("User ID is required to update points.");
  }
  if (isNaN(pointsToAdd)) {
      console.warn(`Attempted to add invalid points (${pointsToAdd}) for user ${userId}. Ignoring.`);
      pointsToAdd = 0; // Default to adding 0 if input is invalid
  }

  const filePath = path.join(pointsBasePath, `${userId}.json`);

  try {
    await ensureDirExists(pointsBasePath); // Ensure directory exists

    let currentPoints = await getUserPoints(userId); // Get current or default points

    const updatedPointsData: UserPoints = {
      ...currentPoints,
      totalPoints: Math.max(0, currentPoints.totalPoints + pointsToAdd), // Ensure points don't go below 0
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(updatedPointsData, null, 2), 'utf-8');
    console.log(`Updated points for user ${userId}. Added: ${pointsToAdd}, New Total: ${updatedPointsData.totalPoints}`);
    return updatedPointsData;

  } catch (error: any) {
    console.error(`Error updating points file for user ${userId}:`, error);
    throw new Error(`Failed to update points. Reason: ${error.message}`);
  }
}

/**
 * Fetches points data for all users. Reads all .json files in the user-points directory.
 * Used for the leaderboard.
 * @returns A promise resolving to an array of UserPoints objects.
 */
export async function getAllUserPoints(): Promise<UserPoints[]> {
    const allPointsData: UserPoints[] = [];
    try {
        await ensureDirExists(pointsBasePath); // Ensure base directory exists
        const files = await fs.readdir(pointsBasePath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
            const userId = file.replace('.json', ''); // Extract userId from filename
            try {
                const pointsData = await getUserPoints(userId); // Use existing function to read/get defaults
                allPointsData.push(pointsData);
            } catch (readError) {
                 console.error(`Error reading points file ${file}:`, readError);
                 // Optionally skip this user or push default data
                 allPointsData.push({ userId, totalPoints: 0, lastUpdated: new Date(0).toISOString() });
            }
        }
    } catch (error: any) {
         if (error.code === 'ENOENT') {
             console.warn(`Points directory not found: ${pointsBasePath}. Returning empty array.`);
             return [];
         }
         console.error(`Error reading all user points data:`, error);
         throw new Error("Failed to retrieve leaderboard data.");
    }
    return allPointsData;
}
