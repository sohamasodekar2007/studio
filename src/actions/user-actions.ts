
// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs'; // Import bcryptjs

const SALT_ROUNDS = 10; // Cost factor for hashing

// WARNING: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars'); // Define avatar path

// Define the default admin user details and pattern
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Fallback if not set in env
const defaultAdminProfileBase: Omit<UserProfile, 'id' | 'createdAt' | 'password'> = {
    email: primaryAdminEmail,
    name: 'Admin User (Primary)',
    phone: '0000000000', // Default placeholder phone
    referral: '',
    class: 'Dropper',
    model: 'combo', // Admin always has combo model
    expiry_date: new Date('2099-12-31T00:00:00.000Z').toISOString(), // Long expiry for admin, ISO format
    avatarUrl: null, // Default avatar
};

/**
 * Ensures a directory exists, creating it if necessary.
 * @param dirPath The path of the directory to ensure exists.
 */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error; // Re-throw if error is not "directory already exists"
    }
  }
}

/**
 * Writes the users array to the users.json file.
 * @param users The array of UserProfile to write.
 * @returns A promise resolving to true on success, false on error.
 */
async function writeUsers(users: UserProfile[]): Promise<boolean> {
    try {
        // Ensure directory exists
        await ensureDirExists(path.dirname(usersFilePath));
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
 * Converts date fields to ISO strings if they are not already.
 * Hashes any plain text passwords found (migration).
 * Assigns roles based on email.
 * Returns user profiles WITHOUT passwords for general use.
 * @returns A promise resolving to an array of UserProfile (with role, without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'> & { role: 'Admin' | 'User' }>> {
    const usersWithPasswords = await readAndInitializeUsersInternal();
    // Assign role and return users WITHOUT passwords
    return usersWithPasswords.map(({ password, ...user }) => ({
        ...user,
        role: getUserRole(user.email) // Assign role based on email
    }));
}

// Helper function to determine role based on email
const getUserRole = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};


/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs, formats dates, hashes passwords),
 * and returns the full user list *including* hashed passwords.
 * Used internally by write operations and auth checks.
 * @returns A promise resolving to the array of UserProfile including passwords.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
  let users: UserProfile[] = [];
  let writeNeeded = false;

  // Ensure avatar directory exists
  await ensureDirExists(publicAvatarsPath);

  try {
    await fs.access(usersFilePath); // Check if file exists first
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array. Re-initializing with default admin.');
      users = [];
      writeNeeded = true;
    } else {
        users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating an empty file with default admin.');
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      writeNeeded = true; // Re-initialize on other errors too
    }
     users = []; // Ensure users is an empty array if read failed
  }

  // --- Ensure all users have string IDs, correct date formats, and hashed passwords ---
  const processedUsers: UserProfile[] = [];
  for (const user of users) { // Use `for...of` for async operations within the loop
    let currentUser = { ...user }; // Create a copy to modify

    if (!currentUser.id || typeof currentUser.id !== 'string') {
        currentUser.id = uuidv4();
        console.warn(`User ${currentUser.email || 'unknown'} assigned new UUID: ${currentUser.id}.`);
        writeNeeded = true;
    }

    // Hash plain text passwords (migration)
    if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
        console.warn(`User ${currentUser.email || currentUser.id} has plain text password. Hashing now.`);
        try {
            currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS);
            writeNeeded = true;
        } catch (hashError) {
            console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError);
            // Keep plain but log error
        }
    } else if (!currentUser.password) {
        console.warn(`User ${currentUser.email || currentUser.id} has no password set.`);
        // Assign a default random password or handle as needed
        try {
            const randomPassword = Math.random().toString(36).slice(-8);
            console.warn(`Assigning temporary password "${randomPassword}" to user ${currentUser.email || currentUser.id}. Hashing...`);
            currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
            writeNeeded = true;
        } catch (hashError) {
            console.error(`Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError);
        }
    }


    if (currentUser.expiry_date && !(currentUser.expiry_date instanceof Date) && isNaN(Date.parse(currentUser.expiry_date))) {
        console.warn(`User ${currentUser.email || currentUser.id} has invalid expiry_date format (${currentUser.expiry_date}). Setting to null.`);
        currentUser.expiry_date = null;
        writeNeeded = true;
    } else if (currentUser.expiry_date instanceof Date) {
        currentUser.expiry_date = currentUser.expiry_date.toISOString(); // Convert Date to ISO string
        writeNeeded = true;
    }

    if (currentUser.createdAt && !(currentUser.createdAt instanceof Date) && isNaN(Date.parse(currentUser.createdAt))) {
        console.warn(`User ${currentUser.email || currentUser.id} has invalid createdAt format (${currentUser.createdAt}). Setting to current time.`);
        currentUser.createdAt = new Date().toISOString();
        writeNeeded = true;
    } else if (currentUser.createdAt instanceof Date) {
        currentUser.createdAt = currentUser.createdAt.toISOString(); // Convert Date to ISO string
        writeNeeded = true;
    } else if (!currentUser.createdAt) {
        currentUser.createdAt = new Date().toISOString();
        writeNeeded = true;
    }

    // Ensure model is valid, default to 'free' if not
    if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
        console.warn(`User ${currentUser.email || currentUser.id} has invalid model (${currentUser.model}). Setting to 'free'.`);
        currentUser.model = 'free';
        writeNeeded = true;
    }
    // Nullify expiry_date if model is 'free'
    if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
        console.warn(`User ${currentUser.email || currentUser.id} is 'free' model but has expiry_date. Setting to null.`);
        currentUser.expiry_date = null;
        writeNeeded = true;
    }
     // Ensure avatarUrl is present, default to null if missing
    if (currentUser.avatarUrl === undefined) {
         currentUser.avatarUrl = null;
         writeNeeded = true;
    }

    processedUsers.push(currentUser); // Add processed user to new array

  } // End of for...of loop

  // --- Ensure Default Admin User Exists and is Correct (with hashed password) ---
   const adminUserIndex = processedUsers.findIndex(u => u.email === primaryAdminEmail);
   let adminPasswordHash = adminUserIndex !== -1 ? processedUsers[adminUserIndex].password : undefined;
   let adminNeedsPasswordUpdate = false;

    // Check if admin needs password hash generation or update
    if (!adminPasswordHash || !adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$')) {
         console.warn(`Hashing default admin password for ${primaryAdminEmail}.`);
        try {
             adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
             adminNeedsPasswordUpdate = true;
             writeNeeded = true; // Ensure file is written if password was hashed
        } catch (hashError) {
            console.error("CRITICAL: Failed to hash default admin password:", hashError);
            adminPasswordHash = defaultAdminPassword; // Fallback to plain text if hashing fails initially
        }
    } else {
        // Check if the stored hash matches the current default password
         const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
         if (!passwordMatch) {
             console.warn(`Admin password in .env has changed. Updating hash for ${primaryAdminEmail}.`);
             try {
                 adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                 adminNeedsPasswordUpdate = true;
                  writeNeeded = true;
             } catch (hashError) {
                console.error("CRITICAL: Failed to re-hash updated default admin password:", hashError);
                // Keep the old hash in this case to avoid locking out
             }
         }
    }

   if (adminUserIndex !== -1) {
    let adminNeedsFieldUpdate = adminNeedsPasswordUpdate; // Start with password update flag
    const currentAdmin = processedUsers[adminUserIndex];

     if (adminNeedsPasswordUpdate) { // Only update if hash was generated/updated
         currentAdmin.password = adminPasswordHash;
     }
     // Check other fields for necessary updates
     if (currentAdmin.model !== 'combo') {
         console.warn(`Admin user ${primaryAdminEmail} model incorrect. Setting to 'combo'.`);
         currentAdmin.model = 'combo';
         adminNeedsFieldUpdate = true;
     }
      if (currentAdmin.expiry_date !== defaultAdminProfileBase.expiry_date) {
         console.warn(`Admin user ${primaryAdminEmail} expiry date incorrect. Setting default.`);
         currentAdmin.expiry_date = defaultAdminProfileBase.expiry_date;
         adminNeedsFieldUpdate = true;
      }
        if (!currentAdmin.createdAt || (currentAdmin.createdAt instanceof Date) || isNaN(Date.parse(currentAdmin.createdAt))) {
             currentAdmin.createdAt = new Date().toISOString(); // Set a valid creation date if missing/invalid
             adminNeedsFieldUpdate = true;
        }
         if (currentAdmin.avatarUrl === undefined) {
             currentAdmin.avatarUrl = null;
             adminNeedsFieldUpdate = true;
         }
     if (adminNeedsFieldUpdate) {
         processedUsers[adminUserIndex] = { ...currentAdmin }; // Ensure a new object reference if updated
         writeNeeded = true;
     }
  } else {
    console.warn(`Default admin user (${primaryAdminEmail}) not found. Adding.`);
    // Create the full admin profile
     const defaultAdminUserWithId: UserProfile = {
       ...defaultAdminProfileBase,
       id: uuidv4(), // Generate new ID for the admin
       password: adminPasswordHash, // Store the hash
       createdAt: new Date().toISOString(), // Set creation date
   };
    processedUsers.push(defaultAdminUserWithId);
    writeNeeded = true;
  }

  if (writeNeeded) {
      const writeSuccess = await writeUsers(processedUsers);
      if (writeSuccess) {
          console.log("users.json created or updated with checks and default admin user details.");
      } else {
          console.error("Failed to write updated users.json file.");
          // Potentially throw error here if critical
      }
  }
  return processedUsers; // Return the processed list
}

// Export the internal function so it can be used by auth-context
export { readAndInitializeUsersInternal as readUsersWithPasswordsInternal };

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Used internally, returns full profile including password hash.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile if found, otherwise null.
 */
export async function findUserByEmailInternal(
  email: string | null, // Allow null email
): Promise<UserProfile | null> {
  if (!email) {
    return null;
  }
  try {
    const users = await readAndInitializeUsersInternal(); // Use internal function
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null; // Return null on error
  }
}


/**
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * Assumes the password provided (if any) is already hashed.
 *
 * @param userProfileData - The full UserProfile object to save or update (password should be hashed or undefined).
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile
): Promise<{ success: boolean; message?: string }> {

    if (!userProfileData.id || typeof userProfileData.id !== 'string') {
        console.error("Attempted to save user without a valid string ID:", userProfileData);
        return { success: false, message: 'Invalid user ID provided for saving.' };
    }

    const userToSave: UserProfile = {
        ...userProfileData,
        // Ensure dates are correctly formatted or null
        expiry_date: userProfileData.expiry_date
                        ? (userProfileData.expiry_date instanceof Date ? userProfileData.expiry_date.toISOString() : new Date(userProfileData.expiry_date).toISOString())
                        : null,
        createdAt: userProfileData.createdAt
                        ? (userProfileData.createdAt instanceof Date ? userProfileData.createdAt.toISOString() : new Date(userProfileData.createdAt).toISOString())
                        : new Date().toISOString(), // Default createdAt if missing
        model: userProfileData.model || 'free',
        email: userProfileData.email,
        name: userProfileData.name || null,
        phone: userProfileData.phone || null,
        class: userProfileData.class || null,
        referral: userProfileData.referral || '' ,
        avatarUrl: userProfileData.avatarUrl === undefined ? null : userProfileData.avatarUrl, // Ensure avatarUrl exists
    };
     if (userToSave.model === 'free') userToSave.expiry_date = null;


    try {
        let users = await readAndInitializeUsersInternal();
        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Merge safely: preserve existing password if not explicitly provided in userToSave
            // Preserve original creation date
            users[existingUserIndex] = {
                ...users[existingUserIndex], // Start with existing
                ...userToSave,             // Override with new data
                // If password is included in userToSave, use it (assume it's hashed), otherwise keep the old one
                password: userToSave.password !== undefined ? userToSave.password : users[existingUserIndex].password,
                createdAt: users[existingUserIndex].createdAt || userToSave.createdAt,
            };
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated.`);
        } else {
            // Add new user (this path should ideally be handled by addUserToJson)
            // Hash password if it exists and isn't already hashed
             if (userToSave.password && !userToSave.password.startsWith('$2a$') && !userToSave.password.startsWith('$2b$')) {
                 console.warn("Hashing password for new user added via saveUserToJson");
                 userToSave.password = await bcrypt.hash(userToSave.password, SALT_ROUNDS);
             }
            users.push(userToSave);
            console.log(`New user ${userToSave.email} (ID: ${userToSave.id}) added via saveUserToJson.`);
        }

        const writeSuccess = await writeUsers(users);
        return { success: writeSuccess, message: writeSuccess ? undefined : 'Failed to write user data.' };
    } catch (error: any) {
        console.error('Failed to save/update user in users.json:', error);
        return { success: false, message: `Failed to save user. Reason: ${error.message}` };
    }
}


/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a UUID. Sets default 'free' model. Hashes the password.
 * @param newUserProfileData - The user profile data for the new user (password should be plain text).
 * @returns A promise resolving with success status, optional message, and the created user profile (without password).
 */
export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'avatarUrl' | 'referral'> & { password: string }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    if (!newUserProfileData.email || !newUserProfileData.password) {
        return { success: false, message: "Email and password are required for new user." };
    }

    try {
         // Hash the password before saving
         const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);

         const userToAdd: UserProfile = {
             id: uuidv4(), // Generate new UUID
             email: newUserProfileData.email,
             password: hashedPassword, // Store the hashed password
             name: newUserProfileData.name || null,
             phone: newUserProfileData.phone || null,
             class: newUserProfileData.class || null,
             model: newUserProfileData.model || 'free',
             // Correctly handle expiry date based on model
             expiry_date: newUserProfileData.model === 'free' ? null : (newUserProfileData.expiry_date ? new Date(newUserProfileData.expiry_date).toISOString() : null),
             createdAt: new Date().toISOString(),
             avatarUrl: null, // Default avatar to null
             referral: '', // Default referral to empty
        };
         if (userToAdd.model === 'free') userToAdd.expiry_date = null; // Ensure expiry is null for free

        let users = await readAndInitializeUsersInternal();

        if (users.some(u => u.email?.toLowerCase() === userToAdd.email?.toLowerCase())) {
            return { success: false, message: 'User with this email already exists.' };
        }

        users.push(userToAdd);
        const success = await writeUsers(users);
        if (success) {
             const { password, ...userWithoutPassword } = userToAdd; // Don't return password hash
            return { success: true, user: userWithoutPassword }; // Return user profile without password hash
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error('Error adding user to JSON:', error);
         // Provide more specific error message if possible
         return { success: false, message: `Failed to add user. Reason: ${error.message || 'Unknown error'}` };
    }
}


/**
 * Updates an existing user in the users.json file by ID.
 * Allows updating specific fields like name, phone, model, expiry_date, avatarUrl.
 * Does NOT update email or password via this function.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update.
 * @returns A promise resolving with success status, optional message, and the updated user profile (without password).
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'email' | 'password' | 'createdAt'>>): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> { // Return Omit<...>
    if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for update." };
    }
    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        const existingUser = users[userIndex];
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData,
            id: userId, // Ensure ID remains
            email: existingUser.email, // Email cannot be changed here
            password: existingUser.password, // Password not changed here
            createdAt: existingUser.createdAt, // Preserve original creation date
             // Handle avatarUrl update specifically
             avatarUrl: updatedData.avatarUrl !== undefined ? updatedData.avatarUrl : existingUser.avatarUrl,
        };

        // Ensure expiry_date is null if model is 'free', otherwise format it
        if (userWithUpdatesApplied.model === 'free') {
            userWithUpdatesApplied.expiry_date = null;
        } else if (updatedData.expiry_date !== undefined) { // Check if expiry_date was part of the update
            userWithUpdatesApplied.expiry_date = updatedData.expiry_date instanceof Date
                                                ? updatedData.expiry_date.toISOString()
                                                : (updatedData.expiry_date ? new Date(updatedData.expiry_date).toISOString() : null);
        }


        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsers(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied; // Remove password before returning
             console.log(`User ${userId} updated. Plan change might require re-login if implemented.`);
             return { success: true, user: userWithoutPassword }; // Return updated user without password
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update user. Reason: ${error.message}` };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the primary admin user.
 * Also deletes the user's avatar image if it exists.
 * @param userId The ID of the user to delete (string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for deletion." };
    }
    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);
        const userToDelete = users[userIndex];


        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }
        if (userToDelete.email === primaryAdminEmail) {
            return { success: false, message: `Cannot delete the primary admin user (${primaryAdminEmail}).` };
        }

        // --- Delete Avatar Image ---
        if (userToDelete.avatarUrl) {
             const avatarFilename = path.basename(userToDelete.avatarUrl);
             const avatarPath = path.join(publicAvatarsPath, avatarFilename);
             try {
                 await fs.access(avatarPath); // Check if file exists
                 await fs.unlink(avatarPath);
                 console.log(`Deleted avatar for user ${userId}: ${avatarPath}`);
             } catch (imgError: any) {
                 if (imgError.code !== 'ENOENT') { // Log error only if it's not "File Not Found"
                    console.error(`Error deleting avatar for user ${userId} (${avatarPath}):`, imgError);
                 } else {
                    console.warn(`Avatar file not found for user ${userId}: ${avatarPath}`);
                 }
             }
        }

        // --- Delete User JSON Entry ---
        users = users.filter(u => u.id !== userId);
        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: `Failed to delete user. Reason: ${error.message}` };
    }
}

/**
 * Updates the password hash for a user in the users.json file.
 * @param userId The ID of the user whose password needs updating (string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for password update." };
    }
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.'};
    }

    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        users[userIndex].password = hashedPassword; // Store the new hash
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
    return null;
  }
  try {
    const usersWithPasswords = await readAndInitializeUsersInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) return null;
    const { password, ...userWithoutPassword } = foundUser;
    return userWithoutPassword;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

// Initialize users.json with default admin if it doesn't exist or is invalid
// This function is called implicitly by readAndInitializeUsersInternal
async function initializeDataStore() {
    try {
        await readAndInitializeUsersInternal();
        console.log("User data store initialized/verified.");
    } catch (error) {
        console.error("Fatal error initializing user data store:", error);
        // Handle critical error, e.g., by preventing app startup or showing a global error
    }
}

// Call initialization on server start (though 'use server' actions run per request)
// For this local file-based system, it's checked on first read.
initializeDataStore();


// Ensure the file ends cleanly without any misplaced code blocks.

