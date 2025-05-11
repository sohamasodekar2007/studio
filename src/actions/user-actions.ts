// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser, UserReferralStats } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; 

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
      if (dirPath === publicAvatarsPath && (error.code === 'EACCES' || error.code === 'EROFS' || (process.env.NETLIFY || process.env.VERCEL))) {
        console.warn(`Warning: Could not create directory ${dirPath} (likely serverless environment, read-only filesystem for public assets at runtime). Avatar uploads requiring server-side directory creation will fail.`);
        return false; 
      }
      console.error(`Error creating directory ${dirPath}:`, error);
      if (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath)) {
           throw new Error(`Failed to create critical data directory: ${dirPath}. Reason: ${error.message}`);
      }
      return false;
    }
    return true; 
  }
}


async function writeUsersToFile(users: UserProfile[]): Promise<boolean> {
  try {
    if (!await ensureDirExists(path.dirname(usersFilePath))) {
        console.error('Failed to ensure users directory exists for users.json');
        throw new Error('Fatal: Cannot create directory for users.json.');
    }
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}
export { writeUsersToFile as internalWriteUsers };


const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    const emailLower = email.toLowerCase();
    return emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower) ? 'Admin' : 'User';
};

function generateReferralCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) { 
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `NEXUS-${result}`;
}

async function readUsersWithPasswordsInternal(): Promise<UserProfile[]> {
    console.log("readUsersWithPasswordsInternal: Attempting to read/initialize users.json...");
    let users: UserProfile[] = [];
    let writeNeeded = false;

    try { 
        console.log("readUsersWithPasswordsInternal: Ensuring data base path exists:", dataBasePath);
        await ensureDirExists(dataBasePath); 
        const avatarsPathExistsOrCreatable = await ensureDirExists(publicAvatarsPath);
        if (!avatarsPathExistsOrCreatable) {
            console.warn("readUsersWithPasswordsInternal: Public avatars directory could not be ensured.");
        }

        try {
            await fs.access(usersFilePath);
            const fileContent = await fs.readFile(usersFilePath, 'utf-8');
            console.log("readUsersWithPasswordsInternal: users.json found and read.");
            const parsedUsers = JSON.parse(fileContent);
            if (!Array.isArray(parsedUsers)) {
                console.warn("readUsersWithPasswordsInternal: users.json is not an array. Re-initializing.");
                users = []; 
                writeNeeded = true;
            } else {
                users = parsedUsers as UserProfile[];
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log("readUsersWithPasswordsInternal: users.json not found. Initializing with default admin.");
                writeNeeded = true;
                users = []; 
            } else {
                console.error("readUsersWithPasswordsInternal: Error reading or parsing users.json, re-initializing:", error.message);
                users = []; 
                writeNeeded = true;
            }
        }

        const processedUsers: UserProfile[] = [];
        for (const user of users) {
            if (typeof user !== 'object' || user === null || (typeof user.id !== 'string' && typeof user.id !== 'number')) {
                console.warn("readUsersWithPasswordsInternal: Skipping invalid user entry:", user);
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
                catch (hashError) { console.error(`readUsersWithPasswordsInternal: Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError); }
            } else if (!currentUser.password) { 
                try {
                    const randomPassword = Math.random().toString(36).slice(-8);
                    currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS); userModified = true;
                    console.warn(`readUsersWithPasswordsInternal: Generated temporary password for user ${currentUser.email || currentUser.id}.`);
                } catch (hashError) { console.error(`readUsersWithPasswordsInternal: CRITICAL - Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError); }
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
            if (currentUser.totalPoints === undefined) { currentUser.totalPoints = 0; userModified = true; }
            if (currentUser.targetYear === undefined) { currentUser.targetYear = null; userModified = true; }
            if (currentUser.telegramId === undefined) { currentUser.telegramId = null; userModified = true; }
            if (currentUser.telegramUsername === undefined) { currentUser.telegramUsername = null; userModified = true; }
            if (currentUser.referralCode === undefined) { currentUser.referralCode = generateReferralCode(); userModified = true; }
            if (currentUser.referredByCode === undefined) { currentUser.referredByCode = null; userModified = true;}
            if (currentUser.referralStats === undefined) {
                currentUser.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
                userModified = true;
            }

            processedUsers.push(currentUser);
            if (userModified) writeNeeded = true;
        }
        users = processedUsers;

        const primaryAdminEffectiveEmail = primaryAdminEmail.toLowerCase();
        let adminUserIndex = users.findIndex(u => u.email?.toLowerCase() === primaryAdminEffectiveEmail);
        let adminPasswordHash = adminUserIndex !== -1 ? users[adminUserIndex].password : undefined;

        if (!adminPasswordHash || typeof adminPasswordHash !== 'string' || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
            try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); writeNeeded = true; }
            catch (hashError) { console.error("readUsersWithPasswordsInternal: CRITICAL - Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; }
        } else {
             try {
                const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
                if (!passwordMatch) {
                    adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                    console.log("readUsersWithPasswordsInternal: Admin password updated to match ADMIN_PASSWORD environment variable.");
                    writeNeeded = true;
                }
            } catch (compareError) { console.error("readUsersWithPasswordsInternal: Error comparing admin password hash:", compareError); }
        }

        if (adminUserIndex !== -1) {
            const currentAdmin = users[adminUserIndex];
            let adminModified = false;
            if (currentAdmin.password !== adminPasswordHash && adminPasswordHash) { currentAdmin.password = adminPasswordHash; adminModified = true; }
            if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; }
            if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; }
            if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
            if (!currentAdmin.referralCode) { currentAdmin.referralCode = generateReferralCode(); adminModified = true; }
            if (!currentAdmin.referralStats) { currentAdmin.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 }; adminModified = true; }
            if (adminModified) writeNeeded = true;
        } else {
            if (!adminPasswordHash) { 
                try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); }
                catch { adminPasswordHash = defaultAdminPassword; } 
            }
            console.log("readUsersWithPasswordsInternal: Primary admin user not found. Creating new admin user...");
            users.push({
                id: uuidv4(), email: primaryAdminEmail, password: adminPasswordHash, name: 'Admin User (Primary)',
                phone: '0000000000', class: 'Dropper', model: 'combo', role: 'Admin',
                expiry_date: '2099-12-31T00:00:00.000Z', createdAt: new Date().toISOString(), avatarUrl: null,
                totalPoints: 0, targetYear: null,
                telegramId: null, telegramUsername: null,
                referralCode: generateReferralCode(),
                referredByCode: null,
                referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
            });
            writeNeeded = true;
        }

        if (writeNeeded) {
            const writeSuccess = await writeUsersToFile(users);
            if (!writeSuccess) {
                console.error("readUsersWithPasswordsInternal: CRITICAL - Failed to write updated users.json file during initialization.");
            } else {
                console.log("readUsersWithPasswordsInternal: users.json initialized/updated successfully.");
            }
        }
        console.log("readUsersWithPasswordsInternal: Finished processing. Users count:", users.length);
        return users;
    } catch (initError: any) {
        console.error("readUsersWithPasswordsInternal: FATAL - Unrecoverable error during user data initialization process:", initError);
        throw new Error(`User data system initialization failed: ${initError.message}`);
    }
}
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

export async function findUserByReferralCode(referralCode: string): Promise<UserProfile | null> {
    if (!referralCode) return null;
    try {
        const users = await readUsersWithPasswordsInternal();
        return users.find(u => u.referralCode === referralCode) || null;
    } catch (error: any) {
        console.error(`Error finding user by referral code ${referralCode}:`, error.message);
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
             console.warn(`Public avatars directory (${publicAvatarsPath}) could not be ensured. Avatar for ${userId} will not be saved.`);
             return null; 
        }
        const fileBuffer = Buffer.from(await avatarFile.arrayBuffer());
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(avatarFile.name).substring(1) || 'png'; 
        const filename = `avatar-${userId}-${uniqueSuffix}.${extension}`;
        const filePath = path.join(publicAvatarsPath, filename);

        await fs.writeFile(filePath, fileBuffer);
        console.log(`Avatar saved locally for user ${userId}: ${filename}`);
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
        console.log(`Deleted local public avatar: ${filename}`);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Attempted to delete avatar ${filename}, but it was not found.`);
            return true; 
        }
        console.error(`Error deleting local public avatar ${filename}:`, error);
        return false;
    }
}

export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    console.log("addUserToJson: Attempting to add user:", newUserProfileData.email);
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
            totalPoints: 0,
            targetYear: newUserProfileData.targetYear || null,
            telegramId: null, 
            telegramUsername: null, 
            referralCode: generateReferralCode(),
            referredByCode: newUserProfileData.referredByCode || null,
            referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
        };

        let users = await readUsersWithPasswordsInternal();
        if (users.some(u => u.email?.toLowerCase() === emailLower)) {
            console.warn("addUserToJson: User with email already exists:", emailLower);
            return { success: false, message: 'User with this email already exists.' };
        }
        console.log("addUserToJson: New user object created:", userToAdd.email, "Role:", userToAdd.role);

        users.push(userToAdd);

        if (newUserProfileData.referredByCode) {
            const referrerIndex = users.findIndex(u => u.referralCode === newUserProfileData.referredByCode);
            if (referrerIndex !== -1) {
                if (!users[referrerIndex].referralStats) { 
                    users[referrerIndex].referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
                }
                users[referrerIndex].referralStats!.referred_free += 1; 
                console.log(`addUserToJson: Referrer ${users[referrerIndex].email} stats updated for new ${userToAdd.model} referral.`);
            } else {
                console.warn(`addUserToJson: Referral code ${newUserProfileData.referredByCode} used, but referrer not found.`);
            }
        }

        const success = await writeUsersToFile(users);
        console.log("addUserToJson: Write users to file status:", success);

        if (success) {
            const { password, ...userWithoutPassword } = userToAdd;
            console.log("addUserToJson: User added successfully:", userWithoutPassword.email);
            return { success: true, user: userWithoutPassword };
        } else {
            console.error("addUserToJson: Failed to write users file. New user not saved.");
            return { success: false, message: 'Failed to write users file. New user not saved.' };
        }
    } catch (error: any) {
        console.error('Error in addUserToJson:', error);
        return { success: false, message: `Server error: ${error.message || 'Could not add user.'}` };
    }
}

export async function updateUserInJson(
    userId: string, 
    updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'>>, 
    avatarFile?: File | null, 
    removeAvatarFlag?: boolean 
): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> {
    console.log(`updateUserInJson: Attempting to update user ID: ${userId}`, "Data:", updatedData, "Has Avatar:", !!avatarFile, "Remove Avatar:", removeAvatarFlag);
    try {
        if (!userId || typeof userId !== 'string') {
            return { success: false, message: "Invalid user ID provided for update." };
        }
        
        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            console.warn(`updateUserInJson: User with ID ${userId} not found.`);
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        const existingUser = users[userIndex];
        let newAvatarFilename = existingUser.avatarUrl || null;

        if (avatarFile instanceof File) { 
            console.log(`updateUserInJson: New avatar file provided for user ${userId}.`);
            if (existingUser.avatarUrl) { 
                console.log(`updateUserInJson: Deleting old avatar ${existingUser.avatarUrl}`);
                await deleteAvatarLocally(existingUser.avatarUrl); 
            }
            newAvatarFilename = await saveAvatarLocally(userId, avatarFile);
            if (!newAvatarFilename && existingUser.avatarUrl) {
                 newAvatarFilename = null; 
                 console.log(`updateUserInJson: New avatar save failed, old avatar was deleted.`);
            } else if (newAvatarFilename) {
                 console.log(`updateUserInJson: New avatar saved as ${newAvatarFilename}`);
            }
        } else if (removeAvatarFlag && existingUser.avatarUrl) { 
             console.log(`updateUserInJson: Removing existing avatar ${existingUser.avatarUrl}`);
            await deleteAvatarLocally(existingUser.avatarUrl);
            newAvatarFilename = null;
        }
        
        // Prepare the data to update, ensuring we don't accidentally allow changing sensitive fields like role/model/expiry here
        // Those should be handled by dedicated functions like updateUserRole or specific admin actions.
        const allowedUpdates: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role' | 'model' | 'expiry_date' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'>> = {};
        if (updatedData.name !== undefined) allowedUpdates.name = updatedData.name;
        if (updatedData.email !== undefined) allowedUpdates.email = updatedData.email; // Handled carefully for admin
        if (updatedData.phone !== undefined) allowedUpdates.phone = updatedData.phone; // Keep phone editable by admin if needed
        if (updatedData.class !== undefined) allowedUpdates.class = updatedData.class;
        if (updatedData.targetYear !== undefined) allowedUpdates.targetYear = updatedData.targetYear;
        // AvatarUrl is handled separately above

        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...allowedUpdates, 
            avatarUrl: newAvatarFilename, 
        };
        
        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsersToFile(users);
        console.log(`updateUserInJson: Write users to file status for ${userId}: ${success}`);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied;
             console.log(`updateUserInJson: User ${userId} updated successfully.`);
             return { success: true, user: userWithoutPassword };
        } else {
            console.error(`updateUserInJson: Failed to write users file for ${userId}.`);
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserInJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update user.'}` };
    }
}


export async function updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User'
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    console.log(`updateUserRole: Attempting to change role for user ID: ${userId} to ${newRole}`);
    try {
        if (!userId) return { success: false, message: "User ID is required." };
        if (!['Admin', 'User'].includes(newRole)) return { success: false, message: "Invalid role specified." };

        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            console.warn(`updateUserRole: User with ID ${userId} not found.`);
            return { success: false, message: `User with ID ${userId} not found.` };
        }
        const userToUpdate = users[userIndex];

        if (userToUpdate.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole !== 'Admin') {
            console.warn(`updateUserRole: Attempt to change role of primary admin ${primaryAdminEmail} denied.`);
            return { success: false, message: "Cannot change the role of the primary admin account." };
        }

        const emailLower = userToUpdate.email?.toLowerCase() || '';
        if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
            console.warn(`updateUserRole: Promotion to Admin denied for ${userToUpdate.email}. Email format incorrect.`);
            return { success: false, message: `Cannot promote to Admin. Email '${userToUpdate.email}' does not follow admin pattern ('username-admin@edunexus.com' or be the primary admin).` };
        }
        if (newRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
            console.warn(`updateUserRole: Demotion to User denied for ${userToUpdate.email} due to reserved admin email format.`);
            return { success: false, message: `Cannot demote to User. Email format '${userToUpdate.email}' is reserved for Admins.`};
        }

        if (userToUpdate.role === newRole) {
            console.log(`updateUserRole: User ${userId} already has role ${newRole}. No change needed.`);
            const { password, ...userWithoutPassword } = userToUpdate; 
            return { success: true, user: userWithoutPassword, message: "User already has this role." };
        }

        console.log(`updateUserRole: Changing role of ${userId} from ${userToUpdate.role} to ${newRole}.`);
        userToUpdate.role = newRole;
        if (newRole === 'Admin') {
            userToUpdate.model = 'combo';
            userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z';
            console.log(`updateUserRole: User ${userId} promoted to Admin. Model set to 'combo', expiry to max.`);
        } else { 
            if (userToUpdate.model === 'combo' || (userToUpdate.model as any) === 'Admin') { 
                userToUpdate.model = 'free';
                userToUpdate.expiry_date = null;
                console.log(`updateUserRole: User ${userId} demoted to User. Model set to 'free', expiry to null.`);
            }
        }

        users[userIndex] = userToUpdate;
        const success = await writeUsersToFile(users);
        console.log(`updateUserRole: Write users file status for ${userId} role change: ${success}`);

        if (success) {
            const { password, ...userWithoutPassword } = userToUpdate; 
            console.log(`updateUserRole: Role for user ${userId} successfully updated to ${newRole}.`);
            return { success: true, user: userWithoutPassword };
        } else {
            console.error(`updateUserRole: Failed to write users file after role update for ${userId}.`);
            return { success: false, message: 'Failed to write users file after role update.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserRole for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update role.'}` };
    }
}


export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`deleteUserFromJson: Attempting to delete user ID: ${userId}`);
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for deletion." };
       }
       
       let users = await readUsersWithPasswordsInternal();
       const userToDelete = users.find(u => u.id === userId);

       if (!userToDelete) {
            console.warn(`deleteUserFromJson: User with ID ${userId} not found.`);
            return { success: false, message: `User with ID ${userId} not found.` };
       }
       if (userToDelete.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
           console.warn(`deleteUserFromJson: Attempt to delete primary admin ${primaryAdminEmail} denied.`);
           return { success: false, message: `Cannot delete the primary admin user (${primaryAdminEmail}).` };
       }

       if (userToDelete.avatarUrl) {
            console.log(`deleteUserFromJson: Deleting avatar ${userToDelete.avatarUrl} for user ${userId}.`);
            await deleteAvatarLocally(userToDelete.avatarUrl);
       }

       users = users.filter(u => u.id !== userId);
       const success = await writeUsersToFile(users);
       console.log(`deleteUserFromJson: Write users file status after deleting ${userId}: ${success}`);
       return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error in deleteUserFromJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not delete user.'}` };
    }
}

export async function updateUserPasswordInJson(userId: string, newPasswordInput: string): Promise<{ success: boolean; message?: string }> {
    console.log(`updateUserPasswordInJson: Attempting to update password for user ID: ${userId}`);
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for password update." };
       }
       if (!newPasswordInput || newPasswordInput.length < 6) {
           return { success: false, message: 'Password must be at least 6 characters long.'};
       }

       let users = await readUsersWithPasswordsInternal();
       const userIndex = users.findIndex(u => u.id === userId);

       if (userIndex === -1) {
           console.warn(`updateUserPasswordInJson: User with ID ${userId} not found.`);
           return { success: false, message: `User with ID ${userId} not found.` };
       }
       const hashedPassword = await bcrypt.hash(newPasswordInput, SALT_ROUNDS);
       users[userIndex].password = hashedPassword;
       const success = await writeUsersToFile(users);
       console.log(`updateUserPasswordInJson: Write users file status for password update of ${userId}: ${success}`);
       return { success, message: success ? "Password updated successfully." : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error in updateUserPasswordInJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update password.'}` };
    }
}

export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId || typeof userId !== 'string') {
    console.warn("getUserById: Invalid or missing userId:", userId);
    return null;
  }
  try {
    const usersWithPasswords = await readUsersWithPasswordsInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) {
        console.warn(`getUserById: User with ID ${userId} not found in backend.`);
        return null;
    }
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

export async function saveUserToJson(userData: UserProfile): Promise<boolean> {
  console.log(`saveUserToJson: Attempting to save user data for: ${userData.email || userData.id}`);
  try {
    let users = await readUsersWithPasswordsInternal();
    const userIndex = users.findIndex(u => u.id === userData.id || (userData.email && u.email?.toLowerCase() === userData.email?.toLowerCase()));

    let finalUserData = { ...userData };

    if (finalUserData.password && !finalUserData.password.startsWith('$2a$') && !finalUserData.password.startsWith('$2b$')) {
      finalUserData.password = await bcrypt.hash(finalUserData.password, SALT_ROUNDS);
      console.log(`saveUserToJson: Password hashed for ${finalUserData.email || finalUserData.id}`);
    } else if (!finalUserData.password && userIndex !== -1 && users[userIndex].password) {
      // If updating and password not provided in userData, keep existing hashed password
      finalUserData.password = users[userIndex].password;
    } else if (!finalUserData.password) {
      console.warn(`saveUserToJson: User data for ${finalUserData.email || finalUserData.id} missing password. This should be handled earlier.`);
    }

    finalUserData.role = getRoleFromEmail(finalUserData.email);
    if (finalUserData.role === 'Admin') {
        finalUserData.model = 'combo';
        finalUserData.expiry_date = '2099-12-31T00:00:00.000Z';
    } else if (finalUserData.model === 'free') {
        finalUserData.expiry_date = null;
    }
    finalUserData.id = finalUserData.id || uuidv4();
    finalUserData.createdAt = finalUserData.createdAt || new Date().toISOString();
    finalUserData.totalPoints = finalUserData.totalPoints ?? 0;
    finalUserData.referralCode = finalUserData.referralCode || generateReferralCode();
    finalUserData.referralStats = finalUserData.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };


    if (userIndex !== -1) {
      console.log(`saveUserToJson: Updating existing user ${finalUserData.email || finalUserData.id}`);
      users[userIndex] = {
          ...users[userIndex], 
          ...finalUserData,    
          password: finalUserData.password || users[userIndex].password, 
      };
    } else {
      console.log(`saveUserToJson: Adding new user ${finalUserData.email || finalUserData.id}`);
      users.push(finalUserData);
    }
    const success = await writeUsersToFile(users);
    console.log(`saveUserToJson: Write users file status for ${finalUserData.email || finalUserData.id}: ${success}`);
    return success;
  } catch (error: any) {
    console.error('Error in saveUserToJson:', error);
    return false;
  }
}

// Function for AuthProvider to check session validity on app load.
// Does not perform password checks, relies on stored session user if valid.
export async function validateAndRefreshSessionUser(
    storedUser: Omit<UserProfile, 'password'>
): Promise<Omit<UserProfile, 'password'> | null> {
    console.log(`validateAndRefreshSessionUser: Validating session for user ID: ${storedUser.id}`);
    if (!storedUser || !storedUser.id || !storedUser.email) {
        console.warn("validateAndRefreshSessionUser: Invalid stored user data provided.");
        return null;
    }
    try {
        const latestProfile = await getUserById(storedUser.id);
        if (!latestProfile) {
            console.warn(`validateAndRefreshSessionUser: User ID ${storedUser.id} not found in backend.`);
            return null; // User might have been deleted
        }

        // Check for critical changes that might require re-login
        const profileChangedCritically =
            storedUser.model !== latestProfile.model ||
            storedUser.role !== latestProfile.role ||
            (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null) ||
            storedUser.email?.toLowerCase() !== latestProfile.email?.toLowerCase(); // Email change check

        if (profileChangedCritically) {
            console.warn(`validateAndRefreshSessionUser: Critical profile change detected for ${latestProfile.email}. Session invalidated.`);
            return null; // Invalidate session, force re-login
        }
        console.log(`validateAndRefreshSessionUser: Session for ${latestProfile.email} is valid. Returning latest profile.`);
        return latestProfile; // Return the latest, validated profile (without password)
    } catch (error) {
        console.error(`Error in validateAndRefreshSessionUser for ${storedUser.id}:`, error);
        return null; // Error during validation
    }
}
