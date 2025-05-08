
// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types'; // Import ContextUser
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';

// --- Helper Functions ---

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function writeUsers(users: UserProfile[]): Promise<boolean> {
  try {
    await ensureDirExists(path.dirname(usersFilePath));
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}

// Helper function to determine role based on email
const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    // Primary admin OR matches the pattern '-admin@edunexus.com'
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};


/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs, formats dates, hashes passwords, assigns roles),
 * and returns the full user list *including* hashed passwords and roles.
 * Used internally by write operations and auth checks.
 * @returns A promise resolving to the array of UserProfile including passwords and roles.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
  let users: UserProfile[] = [];
  let writeNeeded = false;

  await ensureDirExists(publicAvatarsPath);

  try {
    await fs.access(usersFilePath);
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array. Re-initializing.');
      users = [];
      writeNeeded = true;
    } else {
      users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating file with default admin.');
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      writeNeeded = true;
    }
    users = [];
  }

  const processedUsers: UserProfile[] = [];
  for (const user of users) {
    let currentUser = { ...user };
    let userModified = false;

    // Assign ID if missing
    if (!currentUser.id || typeof currentUser.id !== 'string') {
      currentUser.id = uuidv4();
      console.warn(`User ${currentUser.email || 'unknown'} assigned new UUID: ${currentUser.id}.`);
      userModified = true;
    }

    // Assign Role if missing or invalid, based on email pattern
    const expectedRole = getRoleFromEmail(currentUser.email);
    if (!currentUser.role || !['Admin', 'User'].includes(currentUser.role) || currentUser.role !== expectedRole) {
       if (currentUser.role && currentUser.role !== expectedRole) {
            console.warn(`User ${currentUser.email || currentUser.id} role (${currentUser.role}) doesn't match email pattern expectation (${expectedRole}). Correcting to ${expectedRole}.`);
       } else if (!currentUser.role) {
           console.warn(`User ${currentUser.email || currentUser.id} missing role. Assigning role: ${expectedRole}.`);
       }
       currentUser.role = expectedRole;
       userModified = true;
    }

    // Hash plain text passwords
    if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
      console.warn(`User ${currentUser.email || currentUser.id} has plain text password. Hashing now.`);
      try {
        currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS);
        userModified = true;
      } catch (hashError) {
        console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError);
      }
    } else if (!currentUser.password) {
       console.warn(`User ${currentUser.email || currentUser.id} missing password. Assigning temporary password.`);
        try {
            const randomPassword = Math.random().toString(36).slice(-8);
            currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
            userModified = true;
        } catch (hashError) {
            console.error(`Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError);
        }
    }

    // Format dates
    if (currentUser.expiry_date && !(currentUser.expiry_date instanceof Date) && isNaN(Date.parse(currentUser.expiry_date))) {
      currentUser.expiry_date = null; userModified = true;
    } else if (currentUser.expiry_date instanceof Date) {
      currentUser.expiry_date = currentUser.expiry_date.toISOString(); userModified = true;
    }

    if (currentUser.createdAt && !(currentUser.createdAt instanceof Date) && isNaN(Date.parse(currentUser.createdAt))) {
      currentUser.createdAt = new Date().toISOString(); userModified = true;
    } else if (currentUser.createdAt instanceof Date) {
      currentUser.createdAt = currentUser.createdAt.toISOString(); userModified = true;
    } else if (!currentUser.createdAt) {
      currentUser.createdAt = new Date().toISOString(); userModified = true;
    }

    // Validate model and expiry
    if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
      currentUser.model = 'free'; userModified = true;
    }
    if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
      currentUser.expiry_date = null; userModified = true;
    }
     if (currentUser.role === 'Admin' && currentUser.model !== 'combo') { // Ensure Admin has combo
        currentUser.model = 'combo';
        currentUser.expiry_date = '2099-12-31T00:00:00.000Z'; // Set long expiry for admin combo
        userModified = true;
     }

    // Ensure avatarUrl exists
    if (currentUser.avatarUrl === undefined) {
      currentUser.avatarUrl = null; userModified = true;
    }

    processedUsers.push(currentUser);
    if (userModified) writeNeeded = true;
  } // End user loop

  // --- Ensure Default Admin User ---
  const adminUserIndex = processedUsers.findIndex(u => u.email === primaryAdminEmail);
  let adminPasswordHash = adminUserIndex !== -1 ? processedUsers[adminUserIndex].password : undefined;
  let adminNeedsUpdate = false;

  if (!adminPasswordHash || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
    try {
      adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
      adminNeedsUpdate = true;
    } catch (hashError) { console.error("CRITICAL: Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; }
  } else {
     const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
     if (!passwordMatch) {
         console.warn(`Admin password in .env changed. Updating hash for ${primaryAdminEmail}.`);
         try {
             adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
             adminNeedsUpdate = true;
         } catch (hashError) { console.error("CRITICAL: Failed to re-hash admin password:", hashError); }
     }
  }

  if (adminUserIndex !== -1) {
    const currentAdmin = processedUsers[adminUserIndex];
    let adminModified = false;
    if (adminNeedsUpdate) { currentAdmin.password = adminPasswordHash; adminModified = true; }
    if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; console.warn("Correcting primary admin role."); }
    if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; console.warn("Correcting primary admin model.");}
    if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
    if (adminModified) { writeNeeded = true; }
  } else {
    console.warn(`Default admin user (${primaryAdminEmail}) not found. Adding.`);
    processedUsers.push({
      id: uuidv4(),
      email: primaryAdminEmail,
      password: adminPasswordHash,
      name: 'Admin User (Primary)',
      phone: '0000000000',
      class: 'Dropper',
      model: 'combo',
      role: 'Admin', // Explicitly set role
      expiry_date: '2099-12-31T00:00:00.000Z',
      createdAt: new Date().toISOString(),
      avatarUrl: null,
      referral: '',
    });
    writeNeeded = true;
  }

  if (writeNeeded) {
    const writeSuccess = await writeUsers(processedUsers);
    if (!writeSuccess) console.error("Failed to write updated users.json file during initialization.");
  }

  return processedUsers;
}

// Export the internal function including passwords and roles
export { readAndInitializeUsersInternal as readUsersWithPasswordsInternal };

/**
 * Reads the users.json file. Ensures the default admin user exists.
 * Assigns UUID to users missing an ID.
 * Converts date fields to ISO strings if they are not already.
 * Hashes any plain text passwords found (migration).
 * Assigns roles based on email.
 * Returns user profiles WITHOUT passwords but WITH roles for general use.
 * @returns A promise resolving to an array of UserProfile (with role, without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  const usersWithPasswords = await readAndInitializeUsersInternal();
  // Return users WITHOUT passwords but WITH roles
  return usersWithPasswords.map(({ password, ...user }) => ({
    ...user,
    role: user.role || getRoleFromEmail(user.email) // Ensure role exists
  }));
}

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Used internally, returns full profile including password hash and role.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile (with role) if found, otherwise null.
 */
export async function findUserByEmailInternal(
  email: string | null,
): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await readAndInitializeUsersInternal(); // Use internal function
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null;
  }
}

/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a UUID. Sets default 'free' model. Hashes the password. Assigns role.
 * @param newUserProfileData - The user profile data for the new user (password should be plain text). Role property will be ignored and calculated based on email.
 * @returns A promise resolving with success status, optional message, and the created user profile (without password, but with role).
 */
export async function addUserToJson(
  newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'avatarUrl' | 'referral' | 'role'> & { password: string }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
  if (!newUserProfileData.email || !newUserProfileData.password) {
    return { success: false, message: "Email and password are required for new user." };
  }

  const emailLower = newUserProfileData.email.toLowerCase();
  const role = getRoleFromEmail(emailLower); // Determine role from email

  // Validate role vs email constraints
  if (role === 'Admin' && emailLower !== primaryAdminEmail && !adminEmailPattern.test(emailLower)) {
      return { success: false, message: `Invalid email format for Admin role. Use 'name-admin@edunexus.com'.` };
  }
  if (role === 'User' && (emailLower === primaryAdminEmail || adminEmailPattern.test(emailLower))) {
      return { success: false, message: `Email format reserved for Admins cannot be used for User role.` };
  }

  try {
    const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);

    let userModel = newUserProfileData.model || 'free';
    let expiryDate = newUserProfileData.expiry_date ? new Date(newUserProfileData.expiry_date).toISOString() : null;

    if (role === 'Admin') {
        userModel = 'combo';
        expiryDate = '2099-12-31T00:00:00.000Z';
    } else if (userModel === 'free') {
        expiryDate = null;
    }

    const userToAdd: UserProfile = {
      id: uuidv4(),
      email: newUserProfileData.email,
      password: hashedPassword,
      name: newUserProfileData.name || null,
      phone: newUserProfileData.phone || null,
      class: newUserProfileData.class || null,
      model: userModel,
      role: role, // Assign calculated role
      expiry_date: expiryDate,
      createdAt: new Date().toISOString(),
      avatarUrl: null,
      referral: '',
    };

    let users = await readAndInitializeUsersInternal();

    if (users.some(u => u.email?.toLowerCase() === emailLower)) {
      return { success: false, message: 'User with this email already exists.' };
    }

    users.push(userToAdd);
    const success = await writeUsers(users);
    if (success) {
      const { password, ...userWithoutPassword } = userToAdd;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to write users file.' };
    }
  } catch (error: any) {
    console.error('Error adding user to JSON:', error);
    return { success: false, message: `Failed to add user. Reason: ${error.message || 'Unknown error'}` };
  }
}


/**
 * Updates an existing user in the users.json file by ID.
 * Allows updating name, phone, class, model, expiry_date, email, and avatarUrl.
 * Determines role based on the *updated* email.
 * Does NOT update password via this function.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * Handles Admin constraints (fixed model/expiry).
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update. Cannot include password or role directly.
 * @returns A promise resolving with success status, optional message, and the updated user profile (without password, but with role).
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role'>>): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> {
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
        const isPrimaryAdmin = existingUser.email === primaryAdminEmail;

        // Handle potential email change and role derivation
        const newEmail = updatedData.email?.trim().toLowerCase() || existingUser.email; // Use new or existing
        const newRole = getRoleFromEmail(newEmail);

        // *** Role and Email Change Validations ***
        // 1. Prevent changing primary admin's email
        if (isPrimaryAdmin && newEmail !== existingUser.email) {
            return { success: false, message: "Cannot change the email of the primary admin account." };
        }
        // 2. Prevent assigning User role to admin email format
        if (newRole === 'User' && (newEmail === primaryAdminEmail || adminEmailPattern.test(newEmail || ''))) {
            return { success: false, message: "Cannot assign User role to an admin email format." };
        }
         // 3. Prevent assigning Admin role to non-admin email format
         if (newRole === 'Admin' && newEmail !== primaryAdminEmail && !adminEmailPattern.test(newEmail || '')) {
              return { success: false, message: "To grant Admin role, email must match pattern '...-admin@edunexus.com' or be the primary admin." };
         }
        // 4. Check if new email is already taken by another user
        if (newEmail !== existingUser.email) {
            const conflictingUser = await findUserByEmailInternal(newEmail);
            if (conflictingUser && conflictingUser.id !== userId) {
                return { success: false, message: `Email ${newEmail} is already in use by another account.` };
            }
        }

        // Determine final model and expiry based on the potentially new role
        let finalModel = updatedData.model ?? existingUser.model;
        let finalExpiryDate = updatedData.expiry_date !== undefined
                               ? (updatedData.expiry_date instanceof Date ? updatedData.expiry_date : (updatedData.expiry_date ? new Date(updatedData.expiry_date) : null))
                               : (existingUser.expiry_date ? new Date(existingUser.expiry_date) : null);

        if (newRole === 'Admin') {
            finalModel = 'combo';
            finalExpiryDate = new Date('2099-12-31T00:00:00.000Z');
        } else if (finalModel === 'free') {
            finalExpiryDate = null;
        } else if (!finalExpiryDate && finalModel !== 'free') {
             // This condition should ideally be caught earlier by form validation
            return { success: false, message: "Expiry date is required for paid models." };
        }

        const finalExpiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

        // Apply updates
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData, // Apply general updates first
            id: userId, // Ensure ID remains
            email: newEmail, // Apply potentially updated email
            password: existingUser.password, // Password not changed here
            createdAt: existingUser.createdAt, // Preserve original creation date
            role: newRole, // Set the derived role
            model: finalModel, // Apply potentially updated model
            expiry_date: finalExpiryDateString, // Apply potentially updated expiry
            // Handle avatarUrl update specifically
            avatarUrl: updatedData.avatarUrl !== undefined ? updatedData.avatarUrl : existingUser.avatarUrl,
        };

        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsers(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied; // Remove password before returning
             console.log(`User ${userId} updated. Role: ${newRole}, Model: ${finalModel}`);
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
 * Updates the role of a user directly.
 * This is a specific action for promoting/demoting users.
 * Handles email format validation based on the new role.
 * Updates model and expiry according to the new role.
 * @param userId The ID of the user to update.
 * @param newRole The new role ('Admin' or 'User').
 * @returns Promise resolving with success status and the updated user profile (without password).
 */
export async function updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User'
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
     if (!userId) return { success: false, message: "User ID is required." };
     if (!['Admin', 'User'].includes(newRole)) return { success: false, message: "Invalid role specified." };

     try {
         let users = await readAndInitializeUsersInternal();
         const userIndex = users.findIndex(u => u.id === userId);

         if (userIndex === -1) {
             return { success: false, message: `User with ID ${userId} not found.` };
         }

         const userToUpdate = users[userIndex];

         // --- Role Change Validations ---
         // 1. Prevent changing the primary admin's role
         if (userToUpdate.email === primaryAdminEmail && newRole !== 'Admin') {
             return { success: false, message: "Cannot change the role of the primary admin account." };
         }
         // 2. Validate email format if promoting to Admin
         if (newRole === 'Admin' && userToUpdate.email !== primaryAdminEmail && !adminEmailPattern.test(userToUpdate.email || '')) {
              return { success: false, message: `Cannot promote to Admin. Email must end with '-admin@edunexus.com' or be the primary admin.` };
         }
          // 3. Validate email format if demoting to User
          if (newRole === 'User' && (userToUpdate.email === primaryAdminEmail || adminEmailPattern.test(userToUpdate.email || ''))) {
             return { success: false, message: `Cannot demote to User. Email format is reserved for Admins.` };
         }


         // --- Update Role and related fields ---
         userToUpdate.role = newRole;
         if (newRole === 'Admin') {
             userToUpdate.model = 'combo';
             userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z'; // Ensure long expiry for admin
         } else {
             // Optional: When demoting, decide what the default plan should be.
             // Setting to 'free' seems reasonable.
             userToUpdate.model = 'free';
             userToUpdate.expiry_date = null;
         }

         users[userIndex] = userToUpdate;
         const success = await writeUsers(users);

         if (success) {
             const { password, ...userWithoutPassword } = userToUpdate;
             return { success: true, user: userWithoutPassword };
         } else {
             return { success: false, message: 'Failed to write users file after role update.' };
         }

     } catch (error: any) {
         console.error(`Error updating role for user ${userId}:`, error);
         return { success: false, message: `Failed to update role. Reason: ${error.message}` };
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
 * Returns the profile WITHOUT the password field but WITH the role.
 * @param userId The ID of the user to retrieve (string).
 * @returns A promise resolving to the UserProfile (without password, with role) if found, otherwise null.
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
     // Ensure role is included in the returned object
     return { ...userWithoutPassword, role: userWithoutPassword.role || getRoleFromEmail(userWithoutPassword.email) };
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}
