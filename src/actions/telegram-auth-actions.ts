// src/actions/telegram-auth-actions.ts
'use server';

import crypto from 'crypto';
import { 
    readUsersWithPasswordsInternal, 
    writeUsersToFile,
    findUserByTelegramIdInternal,
    // addUserToJson, // This might need adjustment if we use it.
    saveUserToJson // Prefer this for direct UserProfile object saving
} from './user-actions';
import type { UserProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramAuthData {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string;
    hash: string;
    phone?: string; 
}

function verifyTelegramData(authData: Record<string, string>): boolean {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error("CRITICAL: TELEGRAM_BOT_TOKEN is not set in environment variables.");
        return false;
    }

    const checkHash = authData.hash;
    if (!checkHash) return false;

    const dataCheckArr = [];
    for (const key in authData) {
        if (key !== 'hash') {
            dataCheckArr.push(`${key}=${authData[key]}`);
        }
    }
    dataCheckArr.sort(); // Important: sort keys alphabetically
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return hmac === checkHash;
}

export async function processTelegramLogin(
    telegramData: Record<string, string>
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string; needsProfileCompletion?: boolean }> {
    if (!TELEGRAM_BOT_TOKEN) {
        return { success: false, message: "Telegram authentication is not configured on the server." };
    }

    const isValid = verifyTelegramData(telegramData);

    if (!isValid) {
        console.error("Telegram Auth Failed: Hash verification failed.", telegramData);
        return { success: false, message: "Telegram authentication failed: Invalid data received." };
    }

    const tgUser = telegramData as unknown as TelegramAuthData;

    try {
        let userProfile = await findUserByTelegramIdInternal(tgUser.id.toString());

        if (userProfile) {
            // User exists
            console.log(`Telegram user ${tgUser.id} (${tgUser.username || tgUser.first_name}) found. Logging in.`);
            const { password, ...userWithoutPassword } = userProfile;
            return { success: true, user: userWithoutPassword };
        } else {
            // New user: create an account
            console.log(`New Telegram user ${tgUser.id} (${tgUser.username || tgUser.first_name}). Creating account.`);
            
            const nameParts = [];
            if (tgUser.first_name) nameParts.push(tgUser.first_name);
            if (tgUser.last_name) nameParts.push(tgUser.last_name);
            const name = nameParts.join(' ') || tgUser.username || `User ${tgUser.id}`;
            
            // Generate a unique, placeholder email. User should be prompted to change this.
            const email = `tg_${tgUser.id}@edunexus.com`; 
            
            // Telegram users don't have a password initially. Generate a secure random one.
            const randomPassword = uuidv4(); // Generate a random string
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const newUserProfile: UserProfile = {
                id: uuidv4(),
                telegramId: tgUser.id.toString(),
                telegramUsername: tgUser.username || null,
                email: email,
                password: hashedPassword, // Store the HASHED random password
                name: name,
                phone: tgUser.phone || null, // Use phone if Telegram provided it
                avatarUrl: tgUser.photo_url || null,
                class: null, // Will need to be completed by user
                model: 'free', // Default to free plan
                role: 'User',
                expiry_date: null,
                createdAt: new Date().toISOString(),
                targetYear: null, // Will need to be completed by user
                referral: '',
                totalPoints: 0,
            };

            // Use saveUserToJson which is designed to take a complete UserProfile object
            const saveSuccess = await saveUserToJson(newUserProfile);

            if (saveSuccess) {
                console.log(`Successfully created new user for Telegram ID ${tgUser.id}`);
                const { password, ...userWithoutPassword } = newUserProfile;
                return { success: true, user: userWithoutPassword, needsProfileCompletion: true };
            } else {
                console.error(`Failed to save new user profile for Telegram ID ${tgUser.id}`);
                return { success: false, message: "Failed to create user account from Telegram data." };
            }
        }
    } catch (error: any) {
        console.error("Error processing Telegram login:", error);
        return { success: false, message: `Server error during Telegram login: ${error.message}` };
    }
}
