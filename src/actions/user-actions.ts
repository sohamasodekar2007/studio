// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // Import crypto for hashing

const SALT_ROUNDS = 10;
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');
const dataBasePath = path.join(process.cwd(), 'src', 'data');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';

async function ensureDirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
        console.error(`Error creating directory ${dirPath}:`, error);
        return false;
    }
    return true; 
  }
}

// Renamed to writeUsersToFile to avoid conflict with the internal user-actions.ts writeUsers
async function writeUsersToFile(users: UserProfile[]): Promise<boolean> {
  try {
    if (!await ensureDirExists(path.dirname(usersFilePath))) {
        console.error('Failed to ensure users directory exists for users.json');
        return false;
    }
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}
// Export for potential direct use if absolutely necessary, but prefer specific actions
export { writeUsersToFile as internalWriteUsers };


const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    const emailLower = email.toLowerCase();
    return emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower) ? 'Admin' : 'User';
};


// Renamed to avoid conflict and make it clear this is internal
async function readUsersWithPasswordsInternal(): Promise<UserProfile[]> {
    console.log("Reading and initializing users from users.json...");
    let users: UserProfile[] = [];
    let writeNeeded = false;

    try { 
        if (!await ensureDirExists(dataBasePath)) {
             throw new Error(`Failed to create base data directory: ${dataBasePath}`);
        }
        if (!await ensureDirExists(publicAvatarsPath)) { 
            throw new Error(`Failed to create public avatars directory: ${publicAvatarsPath}`);
        }

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
                users = []; 
            } else {
                console.error('Error reading or parsing users.json:', error);
                users = [];
                writeNeeded = true;
            }
        }

        const processedUsers: UserProfile[] = [];
        for (const user of users) {
            if (typeof user !== 'object' || user === null || (typeof user.id !== 'string' && typeof user.id !== 'number')) {
                console.warn("Skipping invalid user entry:", user);
                writeNeeded = true;
                continue;
            }

            let currentUser = { ...user };
            let userModified = false;

            if (!currentUser.id) { currentUser.id = uuidv4(); userModified = true; }
            else if (typeof currentUser.id === 'number') { currentUser.id = String(currentUser.id); userModified = true; }

            const derivedRole = getRoleFromEmail(currentUser.email);
            if (currentUser.role === undefined || currentUser.role !== derivedRole) {
                currentUser.role = derivedRole; userModified = true;
            }

            if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
                try { currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS); userModified = true; }
                catch (hashError) { console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError); }
            } else if (!currentUser.password) {
                try {
                    const randomPassword = Math.random().toString(36).slice(-8);
                    currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS); userModified = true;
                } catch (hashError) { console.error(`CRITICAL: Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError); }
            }
            if (currentUser.expiry_date && !(typeof currentUser.expiry_date === 'string' && !isNaN(Date.parse(currentUser.expiry_date)))) {
                try { currentUser.expiry_date = new Date(currentUser.expiry_date).toISOString(); userModified = true; }
                catch { currentUser.expiry_date = null; userModified = true; }
            }
            if (currentUser.createdAt && !(typeof currentUser.createdAt === 'string' && !isNaN(Date.parse(currentUser.createdAt)))) {
                try { currentUser.createdAt = new Date(currentUser.createdAt).toISOString(); userModified = true; }
                catch { currentUser.createdAt = new Date().toISOString(); userModified = true;}
            } else if (!currentUser.createdAt) { currentUser.createdAt = new Date().toISOString(); userModified = true; }

            if (currentUser.role === 'Admin') {
                if (currentUser.model !== 'combo') { currentUser.model = 'combo'; userModified = true; }
                const adminExpiry = '2099-12-31T00:00:00.000Z';
                if (currentUser.expiry_date !== adminExpiry) { currentUser.expiry_date = adminExpiry; userModified = true; }
            } else {
                if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
                    currentUser.model = 'free'; userModified = true;
                }
                if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
                    currentUser.expiry_date = null; userModified = true;
                }
            }
            if (currentUser.avatarUrl === undefined) { currentUser.avatarUrl = null; userModified = true; }
            if (currentUser.class === undefined) { currentUser.class = null; userModified = true; }
            if (currentUser.phone === undefined) { currentUser.phone = null; userModified = true; }
            if (currentUser.referral === undefined) { currentUser.referral = ''; userModified = true; }
            if (currentUser.totalPoints === undefined) { currentUser.totalPoints = 0; userModified = true; }
            if (currentUser.targetYear === undefined) { currentUser.targetYear = null; userModified = true; }
            if (currentUser.telegramId === undefined) { currentUser.telegramId = null; userModified = true; }
            if (currentUser.telegramUsername === undefined) { currentUser.telegramUsername = null; userModified = true; }


            processedUsers.push(currentUser);
            if (userModified) writeNeeded = true;
        }
        users = processedUsers; 

        const primaryAdminEffectiveEmail = primaryAdminEmail.toLowerCase();
        let adminUserIndex = users.findIndex(u => u.email?.toLowerCase() === primaryAdminEffectiveEmail);
        let adminPasswordHash = adminUserIndex !== -1 ? users[adminUserIndex].password : undefined;

        if (!adminPasswordHash || typeof adminPasswordHash !== 'string' || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
            try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); writeNeeded = true; }
            catch (hashError) { console.error("CRITICAL: Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; } 
        } else {
             try {
                const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
                if (!passwordMatch) {
                    adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                    writeNeeded = true;
                }
            } catch (compareError) { console.error("Error comparing admin password hash:", compareError); }
        }


        if (adminUserIndex !== -1) {
            const currentAdmin = users[adminUserIndex];
            let adminModified = false;
            if (currentAdmin.password !== adminPasswordHash && adminPasswordHash) { currentAdmin.password = adminPasswordHash; adminModified = true; }
            if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; }
            if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; }
            if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
            if (adminModified) writeNeeded = true;
        } else {
            if (!adminPasswordHash) { 
                try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); }
                catch { adminPasswordHash = defaultAdminPassword; } 
            }
            users.push({
                id: uuidv4(), email: primaryAdminEmail, password: adminPasswordHash, name: 'Admin User (Primary)',
                phone: '0000000000', class: 'Dropper', model: 'combo', role: 'Admin',
                expiry_date: '2099-12-31T00:00:00.000Z', createdAt: new Date().toISOString(), avatarUrl: null, referral: '', totalPoints: 0, targetYear: null,
                telegramId: null, telegramUsername: null,
            });
            writeNeeded = true;
        }

        if (writeNeeded) {
            const writeSuccess = await writeUsersToFile(users);
            if (!writeSuccess) {
                console.error("CRITICAL: Failed to write updated users.json file during initialization.");
                throw new Error("Failed to save initial user data state.");
            }
        }
        return users;
    } catch (initError: any) {
        console.error("FATAL: Unrecoverable error during user data initialization process:", initError);
        throw new Error(`User data system initialization failed: ${initError.message}`);
    }
}
// Export readUsersWithPasswordsInternal for internal use by AuthContext and other server actions
export { readUsersWithPasswordsInternal };


export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  try {
    const usersWithData = await readUsersWithPasswordsInternal();
    return usersWithData.map(({ password, ...user }) => user);
  } catch (error: any) {
    console.error("Error in readUsers:", error.message);
    return [];
  }
}

export async function findUserByEmailInternal(email: string | null): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await readUsersWithPasswordsInternal();
    const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return foundUser || null;
  } catch (error: any) {
    console.error(`Error finding user by email ${email}:`, error.message);
    return null;
  }
}


export async function findUserByTelegramIdInternal(telegramId: string): Promise<UserProfile | null> {
    if (!telegramId) return null;
    try {
        const users = await readUsersWithPasswordsInternal();
        return users.find(u => u.telegramId === telegramId) || null;
    } catch (error: any) {
        console.error(`Error finding user by Telegram ID ${telegramId}:`, error.message);
        return null;
    }
}


async function saveAvatarLocally(userId: string, avatarFile: File): Promise<string | null> {
    try {
        if (!await ensureDirExists(publicAvatarsPath)) {
             console.error(`Failed to ensure public avatars directory exists: ${publicAvatarsPath}`);
             return null;
        }
        const fileBuffer = Buffer.from(await avatarFile.arrayBuffer());
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(avatarFile.name).substring(1) || 'png';
        const filename = `avatar-${userId}-${uniqueSuffix}.${extension}`;
        const filePath = path.join(publicAvatarsPath, filename);

        await fs.writeFile(filePath, fileBuffer);
        console.log(`Avatar saved to public path for user ${userId}: ${filePath}`);
        return filename;
    } catch (error) {
        console.error(`Error saving avatar locally for user ${userId}:`, error);
        return null;
    }
}

async function deleteAvatarLocally(filename: string): Promise<boolean> {
    try {
        const filePath = path.join(publicAvatarsPath, filename);
        await fs.access(filePath); 
        await fs.unlink(filePath);
        console.log(`Deleted local public avatar: ${filePath}`);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Public avatar file not found for deletion: ${filename}`);
            return true; 
        }
        console.error(`Error deleting local public avatar ${filename}:`, error);
        return false;
    }
}

export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referral' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!newUserProfileData.email || !newUserProfileData.password) {
            return { success: false, message: "Email and password are required for new user." };
        }
        const emailLower = newUserProfileData.email.toLowerCase();
        const assignedRole = getRoleFromEmail(emailLower);

        if (assignedRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
            return { success: false, message: `Admin role can only be assigned to the primary admin email or emails matching 'username-admin@edunexus.com'.` };
        }
        if (assignedRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
            return { success: false, message: `Email format '${emailLower}' is reserved for Admin roles.` };
        }

        const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);
        let userModel: UserModel = newUserProfileData.model || 'free';
        let expiryDate: string | null = newUserProfileData.expiry_date || null;

        if (assignedRole === 'Admin') {
            userModel = 'combo';
            expiryDate = '2099-12-31T00:00:00.000Z';
        } else if (userModel === 'free') {
            expiryDate = null;
        } else if (!expiryDate) { 
            return { success: false, message: "Expiry date is required for paid models." };
        }

        const userToAdd: UserProfile = {
            id: uuidv4(),
            email: newUserProfileData.email,
            password: hashedPassword,
            name: newUserProfileData.name || null,
            phone: newUserProfileData.phone || null,
            class: newUserProfileData.class || null,
            model: userModel,
            role: assignedRole, 
            expiry_date: expiryDate,
            createdAt: new Date().toISOString(),
            avatarUrl: null,
            referral: '',
            totalPoints: 0,
            targetYear: newUserProfileData.targetYear || null,
            telegramId: null, // New users via form won't have this initially
            telegramUsername: null,
        };

        let users = await readUsersWithPasswordsInternal();
        if (users.some(u => u.email?.toLowerCase() === emailLower)) {
            return { success: false, message: 'User with this email already exists.' };
        }

        users.push(userToAdd);
        const success = await writeUsersToFile(users);

        if (success) {
            const { password, ...userWithoutPassword } = userToAdd;
            return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error('Error in addUserToJson:', error);
        return { success: false, message: `Server error: ${error.message || 'Could not add user.'}` };
    }
}

export async function updateUserInJson(
    // Changed to accept an object for easier formData handling
    userId: string,
    updateData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'referral' | 'totalPoints' | 'telegramId' | 'telegramUsername'>> & { avatarFile?: File | null, removeAvatar?: boolean }
): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!userId || typeof userId !== 'string') {
            return { success: false, message: "Invalid user ID provided for update." };
        }
        
        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        const existingUser = users[userIndex];
        let newAvatarFilename = existingUser.avatarUrl || null;

        if (updateData.avatarFile instanceof File) {
            if (existingUser.avatarUrl) { await deleteAvatarLocally(existingUser.avatarUrl); }
            newAvatarFilename = await saveAvatarLocally(userId, updateData.avatarFile);
            if (!newAvatarFilename) console.warn("Failed to save new avatar, keeping old one if any.");
        } else if (updateData.removeAvatar && existingUser.avatarUrl) {
            await deleteAvatarLocally(existingUser.avatarUrl);
            newAvatarFilename = null;
        }
        
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            name: updateData.name !== undefined ? updateData.name : existingUser.name,
            phone: updateData.phone !== undefined ? updateData.phone : existingUser.phone, // Now updatable by admin
            email: updateData.email !== undefined ? updateData.email : existingUser.email, // Email updatable by admin
            class: updateData.class !== undefined ? updateData.class : existingUser.class,
            targetYear: updateData.targetYear !== undefined ? updateData.targetYear : existingUser.targetYear,
            avatarUrl: newAvatarFilename,
            model: updateData.model !== undefined ? updateData.model : existingUser.model,
            expiry_date: updateData.expiry_date !== undefined ? updateData.expiry_date : existingUser.expiry_date,
            // Role should be updated via updateUserRole
        };
        
        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsersToFile(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied;
             return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserInJson:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update user.'}` };
    }
}


export async function updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User'
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!userId) return { success: false, message: "User ID is required." };
        if (!['Admin', 'User'].includes(newRole)) return { success: false, message: "Invalid role specified." };

        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }
        const userToUpdate = users[userIndex];

        if (userToUpdate.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole !== 'Admin') {
            return { success: false, message: "Cannot change the role of the primary admin account." };
        }

        const emailLower = userToUpdate.email?.toLowerCase() || '';
        if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
            return { success: false, message: `Cannot promote to Admin. Email '${userToUpdate.email}' does not follow admin pattern ('username-admin@edunexus.com' or primary admin). Change email first or use an appropriate email.` };
        }
        if (newRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
            return { success: false, message: `Cannot demote to User. Email format '${userToUpdate.email}' is reserved for Admins. Change email first.` };
        }

        if (userToUpdate.role === newRole) {
            const { password, ...userWithoutPassword } = userToUpdate;
            return { success: true, user: userWithoutPassword, message: "User already has this role." };
        }

        userToUpdate.role = newRole;
        if (newRole === 'Admin') {
            userToUpdate.model = 'combo';
            userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z';
        } else { 
            if (userToUpdate.model === 'combo' || (userToUpdate.model as any) === 'Admin') { 
                userToUpdate.model = 'free';
                userToUpdate.expiry_date = null;
            }
        }

        users[userIndex] = userToUpdate;
        const success = await writeUsersToFile(users);

        if (success) {
            const { password, ...userWithoutPassword } = userToUpdate;
            return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file after role update.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserRole for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update role.'}` };
    }
}


export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for deletion." };
       }
       
       let users = await readUsersWithPasswordsInternal();
       const userToDelete = users.find(u => u.id === userId);

       if (!userToDelete) {
            return { success: false, message: `User with ID ${userId} not found.` };
       }
       if (userToDelete.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
           return { success: false, message: `Cannot delete the primary admin user (${primaryAdminEmail}).` };
       }

       if (userToDelete.avatarUrl) {
            await deleteAvatarLocally(userToDelete.avatarUrl);
       }

       users = users.filter(u => u.id !== userId);
       const success = await writeUsersToFile(users);
       return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error in deleteUserFromJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not delete user.'}` };
    }
}

export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for password update." };
       }
       if (!newPassword || newPassword.length < 6) {
           return { success: false, message: 'Password must be at least 6 characters long.'};
       }

       let users = await readUsersWithPasswordsInternal();
       const userIndex = users.findIndex(u => u.id === userId);

       if (userIndex === -1) {
           return { success: false, message: `User with ID ${userId} not found.` };
       }
       const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
       users[userIndex].password = hashedPassword;
       const success = await writeUsersToFile(users);
       return { success, message: success ? undefined : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error in updateUserPasswordInJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update password.'}` };
    }
}

export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  try {
    const usersWithPasswords = await readUsersWithPasswordsInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) return null;
    const { password, ...userWithoutPassword } = foundUser;
    return userWithoutPassword;
  } catch (error: any) {
    console.error(`Error finding user by ID ${userId}:`, error.message);
    return null;
  }
}

export async function checkUserPlanAndExpiry(userId: string): Promise<{ isPlanValid: boolean; message?: string }> {
    try {
        if (!userId) {
            return { isPlanValid: false, message: "User ID not provided." };
        }
        const currentUser = await getUserById(userId); 
        if (!currentUser) {
            return { isPlanValid: false, message: "User not found." };
        }

        if (currentUser.role === 'Admin') {
            return { isPlanValid: true };
        }
        if (currentUser.model === 'free') {
            return { isPlanValid: true };
        }
        if (!currentUser.expiry_date) {
            return { isPlanValid: false, message: "Subscription details incomplete (missing expiry date)." };
        }
        const expiry = new Date(currentUser.expiry_date);
        if (isNaN(expiry.getTime()) || expiry < new Date()) {
            return { isPlanValid: false, message: "Your subscription has expired." };
        }
        return { isPlanValid: true };
    } catch (error: any) {
        console.error("Error in checkUserPlanAndExpiry:", error);
        return { isPlanValid: false, message: `Error verifying subscription status: ${error.message}` };
    }
}

// Modified to accept UserProfile for easier direct saving, e.g., from Telegram auth
export async function saveUserToJson(userData: UserProfile): Promise<boolean> {
  try {
    let users = await readUsersWithPasswordsInternal();
    const userIndex = users.findIndex(u => u.id === userData.id || (userData.email && u.email === userData.email));

    if (userIndex !== -1) {
      const existingUser = users[userIndex];
      let newPasswordHash = userData.password ?? existingUser.password;
      // Only re-hash if a new plain password is provided and it's not already a hash
      if (userData.password && !userData.password.startsWith('$2a$') && !userData.password.startsWith('$2b$')) {
          newPasswordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);
      }

      users[userIndex] = {
          ...existingUser,
          ...userData, // This will overwrite existing fields with userData's fields
          password: newPasswordHash, 
          role: userData.role ?? existingUser.role ?? getRoleFromEmail(userData.email),
          totalPoints: userData.totalPoints ?? existingUser.totalPoints ?? 0,
          createdAt: userData.createdAt ?? existingUser.createdAt ?? new Date().toISOString(),
          id: userData.id ?? existingUser.id ?? uuidv4(),
          targetYear: userData.targetYear !== undefined ? userData.targetYear : existingUser.targetYear,
          telegramId: userData.telegramId !== undefined ? userData.telegramId : existingUser.telegramId,
          telegramUsername: userData.telegramUsername !== undefined ? userData.telegramUsername : existingUser.telegramUsername,
      };
    } else {
      // New user, ensure password is hashed
      const assignedRole = userData.role || getRoleFromEmail(userData.email);
      let hashedPassword = userData.password;
       if (hashedPassword && !hashedPassword.startsWith('$2a$') && !hashedPassword.startsWith('$2b$')) {
            hashedPassword = await bcrypt.hash(hashedPassword, SALT_ROUNDS);
       } else if (!hashedPassword) {
            // If creating a new user and no password is provided (e.g., Telegram login),
            // generate a secure random password and hash it.
            const randomPassword = uuidv4(); // Or a more robust random string generator
            hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);
            console.warn(`No password provided for new user ${userData.email || userData.id}. A random password has been generated.`);
       }
      users.push({
        ...userData,
        id: userData.id || uuidv4(),
        createdAt: userData.createdAt || new Date().toISOString(),
        role: assignedRole,
        password: hashedPassword,
        totalPoints: userData.totalPoints ?? 0,
        targetYear: userData.targetYear !== undefined ? userData.targetYear : null,
        telegramId: userData.telegramId || null,
        telegramUsername: userData.telegramUsername || null,
      });
    }
    return await writeUsersToFile(users);
  } catch (error: any) {
    console.error('Error in saveUserToJson:', error);
    return false;
  }
}
