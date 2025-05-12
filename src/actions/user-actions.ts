// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser, UserReferralStats } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; 

const SALT_ROUNDS = 10;
const dataBasePath = path.join(process.cwd(), 'src', 'data');
const usersFilePath = path.join(dataBasePath, 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';


async function ensureDirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Directory ensured: ${dirPath}`);
    return true;
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      if ((process.env.NETLIFY || process.env.VERCEL) && (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath) || dirPath === publicAvatarsPath) ) {
        console.warn(`Warning: Could not create directory ${dirPath} (serverless environment). Feature relying on this path might fail if directory/file doesn't pre-exist.`);
        return false; 
      }
      console.error(`Error creating directory ${dirPath}:`, error);
      if (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath)) {
           throw new Error(`Failed to create critical data directory: ${dirPath}. Reason: ${error.message}. Check permissions or if the path is valid.`);
      }
      return false;
    }
    // console.log(`Directory already exists: ${dirPath}`); // Less verbose
    return true; 
  }
}


async function writeUsersToFile(users: UserProfile[]): Promise<boolean> {
  try {
    if (process.env.NETLIFY || process.env.VERCEL) {
        console.warn("writeUsersToFile: In a serverless environment. User data writes to users.json are ephemeral and will not persist across deployments or multiple function invocations. For persistent user data, a database solution is required.");
        // Optionally, prevent write attempts entirely in serverless for clarity,
        // or let it proceed knowing it might fail or be temporary.
        // For now, we'll let it try, but it's good to be aware.
    }
    if (!await ensureDirExists(path.dirname(usersFilePath))) { 
        console.error(`Failed to ensure users directory exists: ${path.dirname(usersFilePath)}`);
        if (!(process.env.NETLIFY || process.env.VERCEL)) {
            throw new Error('Fatal: Cannot create directory for users.json.');
        }
        return false; 
    }
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    // console.log("writeUsersToFile: users.json written successfully."); // Less verbose
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

async function internalReadUsersWithPasswords(): Promise<UserProfile[]> {
    console.log("internalReadUsersWithPasswords: Attempting to read/initialize users.json...");
    let users: UserProfile[] = [];
    let writeNeeded = false; // Flag to track if users.json needs to be re-written

    try { 
        if (!await ensureDirExists(dataBasePath)) {
            if (!(process.env.NETLIFY || process.env.VERCEL)) {
                 throw new Error(`Critical: Data directory ${dataBasePath} could not be ensured.`);
            }
            console.warn(`internalReadUsersWithPasswords: Data directory ${dataBasePath} could not be ensured (serverless context).`);
        }
        
        const avatarsPathExistsOrCreatable = await ensureDirExists(publicAvatarsPath);
        if (!avatarsPathExistsOrCreatable) {
            console.warn("internalReadUsersWithPasswords: Public avatars directory could not be ensured.");
        }

        try {
            await fs.access(usersFilePath); 
            const fileContent = await fs.readFile(usersFilePath, 'utf-8');
            // console.log("internalReadUsersWithPasswords: users.json found and read."); // Less verbose
            
            if (fileContent.trim() === '') {
                console.warn("internalReadUsersWithPasswords: users.json is empty. Will attempt to initialize with default admin.");
                users = []; 
                writeNeeded = true;
            } else {
                const parsedUsers = JSON.parse(fileContent);
                if (!Array.isArray(parsedUsers)) {
                    console.warn("internalReadUsersWithPasswords: users.json content is not an array. Will attempt to initialize.");
                    users = [];
                    writeNeeded = true;
                } else {
                    users = parsedUsers as UserProfile[];
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                if (process.env.NETLIFY || process.env.VERCEL) {
                    // On Netlify/Vercel, if users.json is not found, it means it wasn't deployed.
                    // This is a critical setup error for these environments.
                    const serverlessErrorMsg = "users.json not found in deployed files. This file is essential for user authentication and must be included in your repository and deployment. Please ensure 'src/data/users.json' exists and contains at least the default admin user.";
                    console.error(`internalReadUsersWithPasswords: ${serverlessErrorMsg}`);
                    throw new Error(serverlessErrorMsg);
                }
                console.log("internalReadUsersWithPasswords: users.json not found locally. Will attempt to initialize with default admin.");
                users = []; 
                writeNeeded = true;
            } else {
                console.error("internalReadUsersWithPasswords: Error reading or parsing users.json. Will attempt to re-initialize.", error.message);
                users = []; 
                writeNeeded = true;
            }
        }

        // Process users: ensure essential fields, hash passwords, set defaults
        const processedUsers: UserProfile[] = [];
        for (const u of users) {
            if (typeof u !== 'object' || u === null || (typeof u.id !== 'string' && typeof u.id !== 'number')) {
                console.warn("internalReadUsersWithPasswords: Skipping invalid user entry:", u);
                writeNeeded = true;
                continue;
            }

            let currentUser = { ...u };
            let userModified = false;

            if (!currentUser.id) { currentUser.id = uuidv4(); userModified = true; }
            else if (typeof currentUser.id === 'number') { currentUser.id = String(currentUser.id); userModified = true; }

            const derivedRole = getRoleFromEmail(currentUser.email);
            if (currentUser.role === undefined || currentUser.role !== derivedRole) {
                currentUser.role = derivedRole; userModified = true;
            }
            
            if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
                try { currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS); userModified = true; }
                catch (hashError) { console.error(`internalReadUsersWithPasswords: Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError); }
            } else if (!currentUser.password) { 
                try {
                    const randomPassword = Math.random().toString(36).slice(-8); 
                    currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS); userModified = true;
                    console.warn(`internalReadUsersWithPasswords: Generated temporary password for user ${currentUser.email || currentUser.id}.`);
                } catch (hashError) { console.error(`internalReadUsersWithPasswords: CRITICAL - Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError); }
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
            catch (hashError) { console.error("internalReadUsersWithPasswords: CRITICAL - Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; }
        } else if (defaultAdminPassword) { 
             try {
                const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
                if (!passwordMatch) {
                    adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                    console.log("internalReadUsersWithPasswords: Admin password updated to match ADMIN_PASSWORD environment variable.");
                    writeNeeded = true;
                }
            } catch (compareError) { console.error("internalReadUsersWithPasswords: Error comparing admin password hash:", compareError); }
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
            console.log("internalReadUsersWithPasswords: Primary admin user not found. Creating new admin user...");
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
             if (process.env.NETLIFY || process.env.VERCEL) {
                 console.warn("internalReadUsersWithPasswords: Write to users.json skipped in serverless environment during initialization. Ensure users.json is pre-populated and deployed.");
             } else {
                console.log("internalReadUsersWithPasswords: Changes detected or initialization needed. Attempting to write users.json...");
                const writeSuccess = await writeUsersToFile(users);
                if (!writeSuccess) {
                    const errorMsg = "internalReadUsersWithPasswords: CRITICAL - Failed to write updated users.json file during initialization. Check file permissions and logs.";
                    console.error(errorMsg);
                    throw new Error(errorMsg); // Throw for local dev, as this is critical.
                } else {
                    // console.log("internalReadUsersWithPasswords: users.json initialized/updated successfully."); // Less verbose
                }
             }
        }
        // console.log("internalReadUsersWithPasswords: Finished processing. Users count:", users.length); // Less verbose
        return users;

    } catch (initError: any) {
        console.error("internalReadUsersWithPasswords: FATAL - Unrecoverable error during user data initialization process:", initError);
        throw new Error(`User data system initialization failed: ${initError.message}`);
    }
}
export { internalReadUsersWithPasswords };


export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  try {
    const usersWithData = await internalReadUsersWithPasswords();
    return usersWithData.map(({ password, ...user }) => user);
  } catch (error: any) {
    console.error("Error in public readUsers due to initialization failure:", error.message);
    throw error; 
  }
}

export async function findUserByEmailInternal(email: string | null): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await internalReadUsersWithPasswords(); 
    const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return foundUser || null;
  } catch (error: any) {
    console.error(`Error finding user by email (internal) ${email}:`, error.message);
    if (error.message.startsWith("User data system initialization failed:")) throw error;
    return null;
  }
}

export async function findUserByReferralCode(referralCode: string): Promise<Omit<UserProfile, 'password'> | null> {
    if (!referralCode) return null;
    try {
        const users = await internalReadUsersWithPasswords();
        const foundUser = users.find(u => u.referralCode === referralCode);
        if (!foundUser) return null;
        const {password, ...userWithoutPassword} = foundUser;
        return userWithoutPassword;
    } catch (error: any) {
        console.error(`Error finding user by referral code ${referralCode}:`, error.message);
        if (error.message.startsWith("User data system initialization failed:")) throw error;
        return null;
    }
}

export async function findUserByTelegramIdInternal(telegramId: string): Promise<UserProfile | null> {
    if (!telegramId) return null;
    try {
        const users = await internalReadUsersWithPasswords();
        return users.find(u => u.telegramId === telegramId) || null;
    } catch (error: any) {
        console.error(`Error finding user by Telegram ID (internal) ${telegramId}:`, error.message);
        if (error.message.startsWith("User data system initialization failed:")) throw error;
        return null;
    }
}


export async function addUserToJson(
  newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null }
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords(); 

    const existingUser = users.find(u => u.email?.toLowerCase() === newUserProfileData.email.toLowerCase());
    if (existingUser) {
      console.error(`addUserToJson: Email ${newUserProfileData.email} already exists.`);
      return { success: false, message: 'This email address is already registered.' };
    }

    const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);
    const newUserId = uuidv4();
    const newUserReferralCode = generateReferralCode();

    const newUser: UserProfile = {
      id: newUserId,
      ...newUserProfileData, 
      password: hashedPassword,
      role: getRoleFromEmail(newUserProfileData.email), 
      createdAt: new Date().toISOString(),
      avatarUrl: null, 
      referralCode: newUserReferralCode,
      referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
      totalPoints: 0,
      telegramId: null,
      telegramUsername: null,
    };

    if (newUser.referredByCode) {
        const referrerIndex = users.findIndex(u => u.referralCode === newUser.referredByCode);
        if (referrerIndex !== -1) {
            const referrer = users[referrerIndex];
            if (!referrer.referralStats) { 
                referrer.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
            }
            switch (newUser.model) {
                case 'free': referrer.referralStats.referred_free++; break;
                case 'chapterwise': referrer.referralStats.referred_chapterwise++; break;
                case 'full_length': referrer.referralStats.referred_full_length++; break;
                case 'combo': referrer.referralStats.referred_combo++; break;
            }
             users[referrerIndex] = referrer; 
        } else {
            console.warn(`Referrer with code ${newUser.referredByCode} not found.`);
        }
    }


    users.push(newUser);
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = newUser;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save new user to file.' };
    }
  } catch (error: any) {
    console.error('Error adding user to JSON:', error);
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred while adding the user.' };
  }
}

export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  try {
    const users = await internalReadUsersWithPasswords();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error: any) {
     console.error(`Error fetching user by ID ${userId}:`, error.message);
     if (error.message.startsWith("User data system initialization failed:")) throw error;
     return null;
  }
}

export async function updateUserInJson(
  userId: string,
  updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername' | 'avatarUrl'>> & {email?: string},
  avatarFile?: File | null,
  removeAvatar?: boolean
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return { success: false, message: 'User not found.' };
    }

    let userToUpdate = { ...users[userIndex] };
    let changesMade = false;

    if (avatarFile) {
      await ensureDirExists(publicAvatarsPath);
      const oldAvatarPath = userToUpdate.avatarUrl ? path.join(publicAvatarsPath, userToUpdate.avatarUrl) : null;

      const timestamp = Date.now();
      const hash = crypto.createHash('sha256').update(Buffer.from(await avatarFile.arrayBuffer())).digest('hex').substring(0, 8);
      const extension = path.extname(avatarFile.name) || '.png'; 
      const uniqueFilename = `avatar-${userId}-${timestamp}-${hash}${extension}`;
      const newAvatarPath = path.join(publicAvatarsPath, uniqueFilename);

      try {
        await fs.writeFile(newAvatarPath, Buffer.from(await avatarFile.arrayBuffer()));
        userToUpdate.avatarUrl = uniqueFilename; 
        changesMade = true;
        console.log(`New avatar ${uniqueFilename} saved for user ${userId}.`);
        if (oldAvatarPath && userToUpdate.avatarUrl !== path.basename(oldAvatarPath)) { 
             try { await fs.unlink(oldAvatarPath); console.log(`Old avatar ${path.basename(oldAvatarPath)} deleted.`); }
             catch (delError: any) { if (delError.code !== 'ENOENT') console.error("Error deleting old avatar:", delError); }
        }
      } catch (uploadError) {
        console.error("Avatar upload failed:", uploadError);
        return { success: false, message: "Failed to upload avatar." };
      }
    } else if (removeAvatar && userToUpdate.avatarUrl) {
      const avatarToRemovePath = path.join(publicAvatarsPath, userToUpdate.avatarUrl);
      try {
         await fs.unlink(avatarToRemovePath); console.log(`Avatar ${userToUpdate.avatarUrl} removed for user ${userId}.`);
         userToUpdate.avatarUrl = null;
         changesMade = true;
      } catch (delError: any) {
          if (delError.code !== 'ENOENT') console.error("Error removing avatar:", delError);
          else { userToUpdate.avatarUrl = null; changesMade = true; } 
      }
    }
    
    if (updatedData.email && userToUpdate.email?.toLowerCase() !== primaryAdminEmail.toLowerCase()) {
      const existingUserWithNewEmail = users.find(u => u.id !== userId && u.email?.toLowerCase() === updatedData.email!.toLowerCase());
      if (existingUserWithNewEmail) {
        return { success: false, message: 'Email address is already in use by another account.' };
      }
      if(userToUpdate.email !== updatedData.email) {
        userToUpdate.email = updatedData.email;
        changesMade = true;
      }
    }

    (Object.keys(updatedData) as Array<keyof typeof updatedData>).forEach(key => {
      if (key !== 'email' && key !== 'avatarUrl' && updatedData[key] !== undefined && (userToUpdate as any)[key] !== updatedData[key]) {
        (userToUpdate as any)[key] = updatedData[key];
        changesMade = true;
      }
    });
    
    if (userToUpdate.role === 'User') {
        if (userToUpdate.model === 'free' && userToUpdate.expiry_date !== null) {
            userToUpdate.expiry_date = null;
            changesMade = true;
        } else if (userToUpdate.model !== 'free' && !userToUpdate.expiry_date) {
            console.warn(`User ${userId} has model ${userToUpdate.model} but no expiry_date. Ensure this is handled.`);
        }
    }

    if (!changesMade) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword, message: 'No changes detected.' };
    }

    users[userIndex] = userToUpdate;
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save user updates to file.' };
    }
  } catch (error: any) {
    console.error(`Error updating user ${userId}:`, error);
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred while updating user.' };
  }
}


export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const users = await internalReadUsersWithPasswords();
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
            return { success: false, message: "User not found." };
        }
        if (userToDelete.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
            return { success: false, message: "Primary admin account cannot be deleted." };
        }

        const updatedUsers = users.filter(u => u.id !== userId);
        const success = await writeUsersToFile(updatedUsers);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        if (error.message?.startsWith("User data system initialization failed:")) throw error;
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function updateUserPasswordInJson(userId: string, newPasswordPlainText: string): Promise<{ success: boolean; message?: string }> {
    try {
        const users = await internalReadUsersWithPasswords();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return { success: false, message: "User not found." };
        }
        const newHashedPassword = await bcrypt.hash(newPasswordPlainText, SALT_ROUNDS);
        users[userIndex].password = newHashedPassword;
        const success = await writeUsersToFile(users);
        return { success, message: success ? undefined : 'Failed to write users file with new password.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId}:`, error);
        if (error.message?.startsWith("User data system initialization failed:")) throw error;
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function updateUserRole(
  userId: string,
  newRole: 'Admin' | 'User'
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return { success: false, message: "User not found." };
    }

    let userToUpdate = users[userIndex];
    const oldRole = userToUpdate.role;

    if (userToUpdate.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole === 'User') {
        return { success: false, message: "Cannot change the role of the primary admin account." };
    }
    
    const emailLower = userToUpdate.email?.toLowerCase() || '';
    if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
         return { success: false, message: "Cannot promote to Admin. Email must end with '-admin@edunexus.com' or be the primary admin." };
    }
     if (newRole === 'User' && adminEmailPattern.test(emailLower) && emailLower !== primaryAdminEmail.toLowerCase()) {
        return { success: false, message: "Cannot demote to User if email format is for Admins. Please change email first if intended." };
    }

    if (oldRole === newRole) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword, message: "Role is already set to this value." };
    }

    userToUpdate.role = newRole;
    if (newRole === 'Admin') {
        userToUpdate.model = 'combo';
        userToUpdate.expiry_date = new Date('2099-12-31T00:00:00.000Z').toISOString();
    } else if (newRole === 'User' && oldRole === 'Admin') {
        userToUpdate.model = 'free';
        userToUpdate.expiry_date = null;
    }

    users[userIndex] = userToUpdate;
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save user role update to file.' };
    }
  } catch (error: any) {
    console.error(`Error updating role for user ${userId}:`, error);
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function saveUserToJson(
    userProfile: UserProfile
): Promise<boolean> {
    try {
        let users = await internalReadUsersWithPasswords();
        const userIndex = users.findIndex(u => u.id === userProfile.id || (userProfile.email && u.email === userProfile.email)); 

        let userToSave = { ...userProfile };

        if (userToSave.password && !userToSave.password.startsWith('$2a$') && !userToSave.password.startsWith('$2b$')) {
            userToSave.password = await bcrypt.hash(userToSave.password, SALT_ROUNDS);
        } else if (!userToSave.password && userIndex !== -1) {
            userToSave.password = users[userIndex].password;
        } else if (!userToSave.password) {
            const randomPassword = uuidv4(); 
            userToSave.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
        }

        if (userIndex !== -1) {
            users[userIndex] = { ...users[userIndex], ...userToSave }; 
        } else {
            users.push(userToSave); 
        }
        return await writeUsersToFile(users);
    } catch (error) {
        console.error('Error saving user to users.json:', error);
        return false;
    }
}
// This is the function AuthContext expects based on previous interactions.
// It delegates to findUserByEmailInternal which can access password hashes.
export async function findUserByEmail(email: string | null): Promise<UserProfile | null> {
  return findUserByEmailInternal(email);
}
