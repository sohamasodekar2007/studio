
// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// WARNING: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

// Define the default admin user details
const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com'; // Use env var or fallback
// WARNING: Storing default password in code is insecure. Use environment variable or secure config.
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Fallback if not set in env
const defaultAdminProfileBase: Omit<UserProfile, 'id' | 'createdAt'> = {
    email: defaultAdminEmail,
    password: defaultAdminPassword, // Store plain text password ONLY for initial local admin setup (INSECURE)
    name: 'Admin User',
    phone: '1234567890',
    referral: '',
    class: 'Dropper', // Or null/default
    model: 'combo', // Give admin highest access
    expiry_date: '2099-12-31', // Long expiry
};

/**
 * Writes the users array to the users.json file.
 * @param users The array of UserProfile to write.
 * @returns A promise resolving to true on success, false on error.
 */
async function writeUsers(users: UserProfile[]): Promise<boolean> {
    try {
        // Ensure directory exists
        await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write users.json:', error);
        return false;
    }
}


/**
 * Reads the users.json file. Ensures the default admin user exists.
 * Assigns UUID to users missing an ID.
 * Returns user profiles WITHOUT passwords for general use.
 * @returns A promise resolving to an array of UserProfile (without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Omit<UserProfile, 'password'>[]> {
    const usersWithPasswords = await readAndInitializeUsersInternal();
    // Return users WITHOUT passwords for general use
    return usersWithPasswords.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
}

/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs),
 * and returns the full user list *including* passwords.
 * Used internally by write operations and auth checks.
 * @returns A promise resolving to the array of UserProfile including passwords.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
  let users: UserProfile[] = [];
  let writeNeeded = false;

  try {
    await fs.access(usersFilePath); // Check if file exists first
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array. Re-initializing with default admin.');
      users = []; // Start fresh if format is wrong
      writeNeeded = true; // Force write
    } else {
        users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating an empty file with default admin.');
      // File doesn't exist, will create it below
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      // On other errors, still try to proceed with an empty array and default admin
      writeNeeded = true;
    }
     users = []; // Ensure users is an empty array if read failed
  }

  // --- Ensure all users have string IDs ---
  users.forEach(user => {
    if (!user.id || typeof user.id !== 'string') {
        console.warn(`User ${user.email || 'unknown'} missing or has non-string ID. Assigning/Converting to UUID.`);
        user.id = uuidv4(); // Assign UUID if missing or invalid type
        writeNeeded = true;
    }
  });


  // --- Ensure Default Admin User Exists ---
   const adminUserIndex = users.findIndex(u => u.email === defaultAdminEmail);
   const adminId = users[adminUserIndex]?.id || uuidv4(); // Use existing ID or generate new one
   const defaultAdminUserWithId: UserProfile = {
       ...defaultAdminProfileBase,
       id: adminId,
       createdAt: new Date().toISOString(),
   };


  if (adminUserIndex !== -1) {
    // Admin user exists, ensure core properties are set correctly
    let adminNeedsUpdate = false;
    const currentAdmin = users[adminUserIndex];

     // Ensure password exists (only for local setup, highly insecure)
     if (!currentAdmin.password) {
         console.warn(`Admin user ${defaultAdminEmail} missing password in users.json. Setting default.`);
         currentAdmin.password = defaultAdminPassword;
         adminNeedsUpdate = true;
     }
     if (currentAdmin.model !== 'combo') {
          console.warn(`Admin user ${defaultAdminEmail} model incorrect in users.json. Setting model to 'combo'.`);
         currentAdmin.model = 'combo';
         adminNeedsUpdate = true;
     }
      if (currentAdmin.expiry_date !== defaultAdminProfileBase.expiry_date) {
         console.warn(`Admin user ${defaultAdminEmail} expiry date incorrect in users.json. Setting default expiry.`);
         currentAdmin.expiry_date = defaultAdminProfileBase.expiry_date;
         adminNeedsUpdate = true;
      }
       if (currentAdmin.id !== adminId) { // Ensure ID is correct if regenerated
           console.warn(`Admin user ${defaultAdminEmail} ID mismatch. Correcting.`);
           currentAdmin.id = adminId;
           adminNeedsUpdate = true;
       }
     if (adminNeedsUpdate) {
         users[adminUserIndex] = currentAdmin; // Update the user object in the array
         writeNeeded = true;
     }

  } else {
    // Admin user does not exist, add them
    console.warn(`Default admin user (${defaultAdminEmail}) not found in users.json. Adding default admin user.`);
    users.push(defaultAdminUserWithId);
    writeNeeded = true;
  }

  // Write back to file if it was missing, malformed, or admin was added/updated, or users needed ID backfill
  if (writeNeeded) {
      const writeSuccess = await writeUsers(users);
      if (writeSuccess) {
          console.log("users.json created or updated with default admin user details and user ID checks.");
      } else {
          console.error("Failed to write updated users.json file.");
      }
  }

  // Return the full list including passwords for internal use
  return users;
}


/**
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * This function handles the password field internally.
 *
 * @param userProfileData - The full UserProfile object to save or update.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile
): Promise<{ success: boolean; message?: string }> {

    // Ensure ID is present and a string
    if (!userProfileData.id || typeof userProfileData.id !== 'string') {
        console.error("Attempted to save user without a valid string ID:", userProfileData);
        return { success: false, message: 'Invalid user ID provided for saving.' };
    }

    // Prepare user data for saving
    const userToSave: UserProfile = {
        ...userProfileData,
        createdAt: userProfileData.createdAt || new Date().toISOString(), // Ensure createdAt exists
    };

    try {
        // Read full user list including passwords internally for writing
        let users = await readAndInitializeUsersInternal();

        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Update existing user: Merge safely
            // Ensure the password from the existing record is kept unless explicitly provided in userToSave
            userToSave.password = userToSave.password !== undefined ? userToSave.password : users[existingUserIndex].password;
            // Preserve original creation date
            userToSave.createdAt = users[existingUserIndex].createdAt || userToSave.createdAt;
            users[existingUserIndex] = userToSave;
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated in users.json`);
        } else {
            // Add new user
            // Password should already be set in userToSave if needed (e.g., during signup)
            users.push(userToSave);
            console.log(`New user data for ${userToSave.email} (ID: ${userToSave.id}) added to users.json`);
        }

        // Write the updated users array back to the file
        const writeSuccess = await writeUsers(users);
        if (!writeSuccess) {
             return { success: false, message: 'Failed to write user data to local file.' };
        }

        return { success: true };

    } catch (error: any) {
        console.error('Failed to save/update user data in users.json:', error);
        return { success: false, message: 'Failed to save user data locally.' };
    }
}


/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a UUID if ID is missing. Sets default 'free' model if none provided.
 * Stores password as provided (plain text - INSECURE).
 * @param newUser The user profile object to add. Password should be included.
 * @returns A promise resolving with success status and optional message.
 */
export async function addUserToJson(newUser: UserProfile): Promise<{ success: boolean; message?: string }> {

     // Ensure ID is a string (generate if missing) and other defaults
    const userToAdd: UserProfile = {
         ...newUser,
         id: String(newUser.id || uuidv4()), // Ensure ID is string
         createdAt: newUser.createdAt || new Date().toISOString(),
         password: newUser.password, // Expecting plain text password here for local storage
         model: newUser.model || 'free', // Default to free if not specified
         expiry_date: newUser.model === 'free' ? null : newUser.expiry_date, // Nullify expiry if free
         class: newUser.class || null, // Ensure class is null if not provided
         phone: newUser.phone || null,
         name: newUser.name || null,
         referral: newUser.referral || '',
    };

    // Basic validation
    if (!userToAdd.email) return { success: false, message: "User email is required." };
    if (!userToAdd.password) return { success: false, message: "User password is required." };


    try {
        let users = await readAndInitializeUsersInternal(); // Reads the raw list including passwords

        // Check if email already exists
        if (users.some(u => u.email === userToAdd.email)) {
            return { success: false, message: 'User with this email already exists.' };
        }
         // Check if ID already exists (should be rare with UUIDs)
         if (users.some(u => u.id === userToAdd.id)) {
             console.warn(`User with ID ${userToAdd.id} conflict during add operation. Regenerating ID.`);
             userToAdd.id = uuidv4(); // Regenerate ID on conflict
             // Recheck after regeneration (extremely unlikely to collide again)
             if (users.some(u => u.id === userToAdd.id)) {
                return { success: false, message: `User ID conflict even after regeneration.`};
             }
         }

        users.push(userToAdd);

        const success = await writeUsers(users); // writeUsers saves the updated list
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error('Error adding user to JSON:', error);
        return { success: false, message: 'Failed to add user.' };
    }
}

/**
 * Updates an existing user in the users.json file by ID.
 * Allows updating specific fields like name, phone, model, expiry_date.
 * Does NOT update email or password via this function.
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update (excluding id, email, password, createdAt).
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'email' | 'password' | 'createdAt'>>): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readAndInitializeUsersInternal(); // Read raw data
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Merge existing data with updated data, ensuring read-only fields are preserved
        const existingUser = users[userIndex];
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser, // Start with existing data
            ...updatedData,   // Apply the allowed updates (name, phone, model, expiry, class, etc.)
            id: userId,       // Ensure ID remains the same
            email: existingUser.email, // Ensure email remains the same
            password: existingUser.password, // Explicitly keep the existing password field
            createdAt: existingUser.createdAt || new Date().toISOString(), // Preserve original creation date
        };
         // If model changed to 'free', nullify expiry date
         if (updatedData.model === 'free') {
             userWithUpdatesApplied.expiry_date = null;
         }

         users[userIndex] = userWithUpdatesApplied; // Update the user in the array

         console.log(`Updating user ${userId}. New data merged:`, { ...users[userIndex], password: '***' }); // Log without password

        const success = await writeUsers(users);
        if (success) {
             console.log(`Successfully updated user ${userId} in users.json`);
        } else {
             console.error(`Failed to write update for user ${userId} to users.json`);
        }
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update user.' };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the default admin user.
 * @param userId The ID of the user to delete (string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readAndInitializeUsersInternal(); // Read raw data
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Prevent deletion of the primary admin user based on email
        if (userToDelete.email === defaultAdminEmail) {
            return { success: false, message: `Cannot delete the primary admin user (${defaultAdminEmail}).` };
        }


        const initialLength = users.length;
        users = users.filter(u => u.id !== userId);

        if (users.length === initialLength) {
            return { success: false, message: `User with ID ${userId} not found during filter.` };
        }

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: 'Failed to delete user.' };
    }
}

/**
 * Updates the password for a user in the users.json file.
 * WARNING: Highly insecure as it stores plain text. Use ONLY for local demo/admin setup.
 * @param userId The ID of the user whose password needs updating (string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Updating plain text password in users.json is highly insecure.");
    if (!newPassword || newPassword.length < 6) { // Basic password length validation
        return { success: false, message: 'Password must be at least 6 characters long.'};
    }

    try {
        let users = await readAndInitializeUsersInternal(); // Read raw data including passwords
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Update the password field
        users[userIndex].password = newPassword;

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update password.' };
    }
}

/**
 * Retrieves a single user by their ID from users.json.
 * Returns the profile WITHOUT the password field.
 * @param userId The ID of the user to retrieve (string).
 * @returns A promise resolving to the UserProfile (without password) if found, otherwise null.
 */
export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId) {
    return null;
  }
  try {
    // Use the helper that reads and initializes (important for consistency)
    const usersWithPasswords = await readAndInitializeUsersInternal();
    const foundUser = usersWithPasswords.find(u => String(u.id) === String(userId));
    if (!foundUser) return null;
    // Remove password before returning
    const { password, ...userWithoutPassword } = foundUser;
    return userWithoutPassword;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

