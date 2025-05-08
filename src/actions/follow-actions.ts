// src/actions/follow-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { UserFollows } from '@/types';

const followsBasePath = path.join(process.cwd(), 'src', 'data', 'user-follows');

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
 * Reads the follow data for a specific user.
 * Returns a default object if the file doesn't exist.
 * @param userId The ID of the user.
 * @returns A promise resolving to the UserFollows object.
 */
export async function getFollowData(userId: string): Promise<UserFollows> {
  if (!userId) {
    throw new Error("User ID is required to get follow data.");
  }
  const filePath = path.join(followsBasePath, `${userId}.json`);
  const defaultFollows: UserFollows = {
    userId,
    following: [],
    followers: [],
  };

  try {
    await ensureDirExists(followsBasePath); // Ensure base directory exists
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const followData = JSON.parse(fileContent) as UserFollows;
    // Basic validation or merging with defaults if needed
    return { ...defaultFollows, ...followData };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default follow data
      return defaultFollows;
    }
    console.error(`Error reading follow data file for user ${userId}:`, error);
    // Return default on other errors to avoid breaking things, but log it
    return defaultFollows;
  }
}

/**
 * Writes the follow data for a specific user.
 * @param userId The ID of the user.
 * @param data The UserFollows data to write.
 * @returns A promise resolving to true on success, false on failure.
 */
async function writeFollowData(userId: string, data: UserFollows): Promise<boolean> {
  const filePath = path.join(followsBasePath, `${userId}.json`);
  try {
    await ensureDirExists(followsBasePath); // Ensure base directory exists
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write follow data for user ${userId}:`, error);
    return false;
  }
}

/**
 * Makes the current user follow the target user.
 * Updates both users' follow data files.
 * @param currentUserId The ID of the user initiating the follow.
 * @param targetUserId The ID of the user to be followed.
 * @returns A promise resolving with success status and optional message.
 */
export async function followUser(
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; message?: string }> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { success: false, message: "Invalid user IDs provided." };
  }

  try {
    // Get current follow data for both users
    const currentUserData = await getFollowData(currentUserId);
    const targetUserData = await getFollowData(targetUserId);

    // Update current user's 'following' list
    if (!currentUserData.following.includes(targetUserId)) {
      currentUserData.following.push(targetUserId);
    }

    // Update target user's 'followers' list
    if (!targetUserData.followers.includes(currentUserId)) {
      targetUserData.followers.push(currentUserId);
    }

    // Write updated data back for both users
    const writeCurrentSuccess = await writeFollowData(currentUserId, currentUserData);
    const writeTargetSuccess = await writeFollowData(targetUserId, targetUserData);

    if (writeCurrentSuccess && writeTargetSuccess) {
      console.log(`User ${currentUserId} successfully followed ${targetUserId}`);
      return { success: true };
    } else {
      // Handle potential partial write failure (needs rollback logic in real app)
      console.error(`Failed to write follow data. Current: ${writeCurrentSuccess}, Target: ${writeTargetSuccess}`);
      return { success: false, message: "Failed to update follow status." };
    }
  } catch (error: any) {
    console.error(`Error in followUser (${currentUserId} -> ${targetUserId}):`, error);
    return { success: false, message: error.message || "Could not follow user." };
  }
}

/**
 * Makes the current user unfollow the target user.
 * Updates both users' follow data files.
 * @param currentUserId The ID of the user initiating the unfollow.
 * @param targetUserId The ID of the user to be unfollowed.
 * @returns A promise resolving with success status and optional message.
 */
export async function unfollowUser(
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; message?: string }> {
  if (!currentUserId || !targetUserId) {
    return { success: false, message: "Invalid user IDs provided." };
  }

  try {
    // Get current follow data for both users
    const currentUserData = await getFollowData(currentUserId);
    const targetUserData = await getFollowData(targetUserId);

    // Update current user's 'following' list
    currentUserData.following = currentUserData.following.filter(id => id !== targetUserId);

    // Update target user's 'followers' list
    targetUserData.followers = targetUserData.followers.filter(id => id !== currentUserId);

    // Write updated data back for both users
    const writeCurrentSuccess = await writeFollowData(currentUserId, currentUserData);
    const writeTargetSuccess = await writeFollowData(targetUserId, targetUserData);

    if (writeCurrentSuccess && writeTargetSuccess) {
       console.log(`User ${currentUserId} successfully unfollowed ${targetUserId}`);
       return { success: true };
    } else {
       console.error(`Failed to write unfollow data. Current: ${writeCurrentSuccess}, Target: ${writeTargetSuccess}`);
       return { success: false, message: "Failed to update follow status." };
    }
  } catch (error: any) {
    console.error(`Error in unfollowUser (${currentUserId} -> ${targetUserId}):`, error);
    return { success: false, message: error.message || "Could not unfollow user." };
  }
}
