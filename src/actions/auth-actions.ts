// src/actions/auth-actions.ts
'use server';

import type { UserProfile } from '@/types';
import { findUserByEmailInternal } from './user-actions'; // Import internal function

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Useful for checking if an email exists or for profile lookups.
 * IMPORTANT: Does NOT verify the user's identity or password.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile (including password hash) if found, otherwise null.
 */
export async function findUserByEmail(
  email: string,
): Promise<UserProfile | null> {
  // Delegate to the function in user-actions that can read the full profile
  return findUserByEmailInternal(email); 
}
