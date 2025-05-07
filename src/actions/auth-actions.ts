// src/actions/auth-actions.ts
'use server';

import type { UserProfile } from '@/types';
import { findUserByEmailInternal } from './user-actions'; // Import internal function from user-actions

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Useful for checking if an email exists or for profile lookups during signup.
 * IMPORTANT: Does NOT verify the user's identity or password.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile (including password hash) if found, otherwise null.
 */
export async function findUserByEmail(
  email: string,
): Promise<UserProfile | null> {
  return findUserByEmailInternal(email); // Delegate to the function in user-actions
}

// Removed readUsersWithPasswordsInternal as it's now exported directly from user-actions.ts
// async function readUsersWithPasswordsInternal(): Promise<UserProfile[]> { ... }
