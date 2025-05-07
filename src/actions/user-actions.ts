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
    expiry_date: '2099-12-31T00:00:00.000Z', // Use ISO format for consistency, long expiry
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

  // --- Ensure all users have string IDs (UUIDs) ---
  users.forEach(user => {
    if (!user.id || typeof user.id !== 'string') {
        const oldId = user.id;
        user.id = uuidv4(); // Assign UUID if missing or invalid type
        console.warn(`User ${user.email || 'unknown'} (Old ID: ${oldId}) missing or has non-string ID. Assigned new UUID: ${user.id}.`);
        writeNeeded = true;
    }
     // Ensure expiry date is ISO string or null
     if (user.expiry_date && !(typeof user.expiry_date === 'string' && !isNaN(Date.parse(user.expiry_date))) && user.expiry_date !== null) {
        console.warn(`User ${user.email || user.id} has invalid expiry_date format (${user.expiry_date}). Setting to null.`);
        user.expiry_date = null;
        writeNeeded = true;
     }
     // Ensure createdAt is ISO string
      if (user.createdAt && !(typeof user.createdAt === 'string' && !isNaN(Date.parse(user.createdAt)))) {
          console.warn(`User ${user.email || user.id} has invalid createdAt format (${user.createdAt}). Setting to current time.`);
          user.createdAt = new Date().toISOString();
          writeNeeded = true;
      } else if (!user.createdAt) {
           user.createdAt = new Date().toISOString();
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
       // Ensure expiry is ISO string
       expiry_date: defaultAdminProfileBase.expiry_date ? new Date(defaultAdminProfileBase.expiry_date).toISOString() : null
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
      if (currentAdmin.expiry_date !== defaultAdminUserWithId.expiry_date) { // Compare ISO strings
         console.warn(`Admin user ${defaultAdminEmail} expiry date incorrect in users.json (${currentAdmin.expiry_date} vs ${defaultAdminUserWithId.expiry_date}). Setting default expiry.`);
         currentAdmin.expiry_date = defaultAdminUserWithId.expiry_date;
         adminNeedsUpdate = true;
      }
       if (currentAdmin.id !== adminId) { // Ensure ID is correct if regenerated
           console.warn(`Admin user ${defaultAdminEmail} ID mismatch. Correcting.`);
           currentAdmin.id = adminId;
           adminNeedsUpdate = true;
       }
        if (!currentAdmin.createdAt) {
             currentAdmin.createdAt = new Date().toISOString();
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

  // Write back to file if it was missing, malformed, or admin was added/updated, or users needed ID/date backfill
  if (writeNeeded) {
      const writeSuccess = await writeUsers(users);
      if (writeSuccess) {
          console.log("users.json created or updated with default admin user details and user field checks.");
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
 * Converts Date objects for expiry_date to ISO strings before saving.
 *
 * @param userProfileData - The full UserProfile object to save or update (expiry_date can be Date object).
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile & { expiry_date?: Date | string | null } // Allow Date object input
): Promise<{ success: boolean; message?: string }> {

    // Ensure ID is present and a string
    if (!userProfileData.id || typeof userProfileData.id !== 'string') {
        console.error("Attempted to save user without a valid string ID:", userProfileData);
        return { success: false, message: 'Invalid user ID provided for saving.' };
    }

    // Prepare user data for saving: Convert Date object to ISO string if necessary
    const userToSave: UserProfile = {
        ...userProfileData,
        expiry_date: userProfileData.expiry_date instanceof Date
                        ? userProfileData.expiry_date.toISOString()
                        : userProfileData.expiry_date, // Keep string or null as is
        createdAt: userProfileData.createdAt || new Date().toISOString(), // Ensure createdAt exists
    };

    try {
        // Read full user list including passwords internally for writing
        let users = await readAndInitializeUsersInternal();

        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Update existing user: Merge safely
            // Ensure the password from the existing record is kept unless explicitly provided in userToSave
             // Preserve original creation date if it exists, otherwise use provided or new
            const mergedUser = {
                ...users[existingUserIndex], // Start with existing data
                ...userToSave, // Override with new data (name, phone, model, class, expiry_date etc.)
                password: userToSave.password !== undefined ? userToSave.password : users[existingUserIndex].password, // Keep existing password unless new one provided
                id: userToSave.id, // Ensure ID remains the same
                email: userToSave.email, // Ensure email remains the same (though shouldn't change here)
                createdAt: users[existingUserIndex].createdAt || userToSave.createdAt, // Preserve original creation date
            };
             users[existingUserIndex] = mergedUser;
            console.log(`User data for ${mergedUser.email} (ID: ${mergedUser.id}) updated in users.json`);
        } else {
            // Add new user (less common through saveUserToJson, usually via addUserToJson)
            users.push(userToSave);
            console.log(`New user data for ${userToSave.email} (ID: ${userToSave.id}) added to users.json via saveUser`);
        }

        // Write the updated users array back to the file
        const writeSuccess = await writeUsers(users);
        if (!writeSuccess) {
             return { success: false, message: 'Failed to write user data to local file.' };
        }

        return { success: true };

    } catch (error: any) {
        console.error('Failed to save/update user data in users.json:', error);
        return { success: false, message: `Failed to save user data locally. Reason: ${error.message}` };
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
         id: String(newUser.id || uuidv4()), // Ensure ID is string UUID
         createdAt: newUser.createdAt || new Date().toISOString(),
         password: newUser.password, // Expecting plain text password here for local storage
         model: newUser.model || 'free', // Default to free if not specified
         // Ensure expiry date is ISO string or null
         expiry_date: newUser.expiry_date ? new Date(newUser.expiry_date).toISOString() : null,
         class: newUser.class || null, // Ensure class is null if not provided
         phone: newUser.phone || null,
         name: newUser.name || null,
         referral: newUser.referral || '',
    };
     // Ensure free model has null expiry date
    if (userToAdd.model === 'free') {
        userToAdd.expiry_date = null;
    }

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
 * Converts Date objects for expiry_date to ISO strings before saving.
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update (excluding id, email, password, createdAt). Can include Date for expiry_date.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'email' | 'password' | 'createdAt'>> & { expiry_date?: Date | string | null }): Promise<{ success: boolean; message?: string }> {
    if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for update." };
    }
    try {
        let users = await readAndInitializeUsersInternal(); // Read raw data
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Prepare the update payload, converting Date to ISO string
         const updatePayload = { ...updatedData };
         if (updatePayload.expiry_date instanceof Date) {
             updatePayload.expiry_date = updatePayload.expiry_date.toISOString();
         }

        // Merge existing data with updated data, ensuring read-only fields are preserved
        const existingUser = users[userIndex];
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser, // Start with existing data
            ...updatePayload, // Apply the allowed updates (name, phone, model, expiry, class, etc.)
            id: userId,       // Ensure ID remains the same
            email: existingUser.email, // Ensure email remains the same
            password: existingUser.password, // Explicitly keep the existing password field
            createdAt: existingUser.createdAt || new Date().toISOString(), // Preserve original creation date
        };
         // If model changed to 'free', nullify expiry date
         if (updatePayload.model === 'free') {
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
        return { success: false, message: `Failed to update user. Reason: ${error.message}` };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the default admin user.
 * @param userId The ID of the user to delete (string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for deletion." };
    }
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
            // This case should theoretically not happen if find succeeded, but added for safety
            console.warn(`User ${userId} found but not removed during filter.`);
            return { success: false, message: `User with ID ${userId} found but could not be filtered out.` };
        }

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: `Failed to delete user. Reason: ${error.message}` };
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
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for password update." };
    }
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
        return { success, message: success ? undefined : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update password. Reason: ${error.message}` };
    }
}

/**
 * Retrieves a single user by their ID from users.json.
 * Returns the profile WITHOUT the password field.
 * @param userId The ID of the user to retrieve (string).
 * @returns A promise resolving to the UserProfile (without password) if found, otherwise null.
 */
export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId || typeof userId !== 'string') {
      console.warn("Attempted to get user by invalid ID:", userId);
    return null;
  }
  try {
    // Use the helper that reads and initializes (important for consistency)
    const usersWithPasswords = await readAndInitializeUsersInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) {
        console.log(`User with ID ${userId} not found in users.json.`);
        return null;
    }
    // Remove password before returning
    const { password, ...userWithoutPassword } = foundUser;
    return userWithoutPassword;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

