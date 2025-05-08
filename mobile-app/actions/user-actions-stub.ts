
// actions/user-actions-stub.ts
// STUB Functions - Replace with API calls in a real React Native app

import type { UserProfile, AcademicStatus, UserModel } from '@/types'; // Assuming shared types
import { v4 as uuidv4 } from 'uuid';
// import bcrypt from 'bcryptjs'; // bcryptjs might not work directly in RN easily, simulate password check

// --- In-memory user store for simulation ---
// In a real app, this data comes from your backend API.
const simulatedUserStore: Record<string, UserProfile> = {
    "admin@edunexus.com": {
        id: "admin-uuid",
        email: "admin@edunexus.com",
        password: "hashed_Soham@1234", // Simulate hashed password
        name: "Admin User",
        phone: "0000000000",
        referral: '',
        class: 'Dropper',
        model: 'combo',
        expiry_date: new Date('2099-12-31T00:00:00.000Z').toISOString(),
        createdAt: new Date().toISOString(),
        role: 'Admin',
        avatarUrl: null,
    },
    "user@edunexus.com": {
         id: "user-uuid",
         email: "user@edunexus.com",
         password: "hashed_user123", // Simulate hashed password
         name: "Regular User",
         phone: "1234567890",
         referral: '',
         class: '12th Class',
         model: 'free',
         expiry_date: null,
         createdAt: new Date().toISOString(),
         role: 'User',
         avatarUrl: null,
     }
};
// --- End Simulation Store ---

// Simulates finding a user by email and checking password
export const findUserByEmailInternal = async (
  email: string,
  passwordToCheck: string // Plain text password
): Promise<UserProfile | null> => {
  console.log(`[STUB] findUserByEmailInternal called for: ${email}`);
  const user = simulatedUserStore[email.toLowerCase()];

  if (user) {
     // Simulate password check (replace with API call)
     // WARNING: Insecure comparison for demo only. Use bcrypt on backend.
     const isPasswordCorrect = `hashed_${passwordToCheck}` === user.password;
     if (isPasswordCorrect) {
         console.log(`[STUB] User found and password matched for: ${email}`);
         return { ...user }; // Return a copy
     } else {
         console.log(`[STUB] User found, but password mismatch for: ${email}`);
         return null;
     }
  }
  console.log(`[STUB] User not found for: ${email}`);
  return null;
};

// Simulates adding a user
export const addUserToJson = async (
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referral' | 'role'> & { password: string } // Expect plain password
): Promise<UserProfile | null> => {
    console.log(`[STUB] addUserToJson called for: ${newUserProfileData.email}`);
    const emailLower = newUserProfileData.email.toLowerCase();

    // Check if email already exists
    if (simulatedUserStore[emailLower]) {
        console.error(`[STUB] Email ${emailLower} already exists.`);
        return null; // Simulate failure
    }

    // Simulate hashing password
    const simulatedHashedPassword = `hashed_${newUserProfileData.password}`;

    const newUser: UserProfile = {
        id: uuidv4(), // Generate new ID
        ...newUserProfileData,
        password: simulatedHashedPassword, // Store "hashed" password
        createdAt: new Date().toISOString(),
        role: newUserProfileData.email === 'admin@edunexus.com' ? 'Admin' : 'User', // Assign role based on email (for demo)
        avatarUrl: null, // Default avatar
        referral: '', // Default referral
    };

    // Add to our simulated store
    simulatedUserStore[emailLower] = newUser;
    console.log(`[STUB] User ${emailLower} added to simulated store.`);
    return { ...newUser }; // Return a copy
};

// Simulates updating a user's password
export const updateUserPasswordInJson = async (
  userId: string,
  newPassword?: string // Expect plain text new password
): Promise<{ success: boolean; message?: string }> => {
   console.log(`[STUB] updateUserPasswordInJson called for user ID: ${userId}`);
   if (!newPassword) {
       return { success: false, message: "New password is required." };
   }

   // Find the user by ID in the simulated store
   let userToUpdate: UserProfile | undefined;
   let userEmailKey: string | undefined;
   for (const email in simulatedUserStore) {
       if (simulatedUserStore[email].id === userId) {
           userToUpdate = simulatedUserStore[email];
           userEmailKey = email;
           break;
       }
   }

   if (!userToUpdate || !userEmailKey) {
       console.error(`[STUB] User with ID ${userId} not found.`);
       return { success: false, message: "User not found." };
   }

   // Simulate hashing the new password
   userToUpdate.password = `hashed_${newPassword}`;
   simulatedUserStore[userEmailKey] = userToUpdate; // Update in store

   console.log(`[STUB] Password updated for user ID: ${userId}`);
   return { success: true };
};

// Add other stub functions (getUserById, updateUserInJson, etc.) if needed for RN simulation
export const getUserById = async (userId: string): Promise<Omit<UserProfile, 'password'> | null> => {
   console.log(`[STUB] getUserById called for: ${userId}`);
   for (const email in simulatedUserStore) {
       if (simulatedUserStore[email].id === userId) {
           const { password, ...userWithoutPassword } = simulatedUserStore[email];
           return userWithoutPassword;
       }
   }
   return null;
}

export const updateUserInJson = async (userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'email' | 'password' | 'createdAt'>>): Promise<{ success: boolean, user?: Omit<UserProfile, 'password'> }> => {
     console.log(`[STUB] updateUserInJson called for ID: ${userId}`, updatedData);
      let userToUpdate: UserProfile | undefined;
      let userEmailKey: string | undefined;
      for (const email in simulatedUserStore) {
         if (simulatedUserStore[email].id === userId) {
             userToUpdate = simulatedUserStore[email];
             userEmailKey = email;
             break;
         }
      }

       if (!userToUpdate || !userEmailKey) {
         return { success: false };
      }

       // Merge updates
      const updatedProfile = { ...userToUpdate, ...updatedData };
      simulatedUserStore[userEmailKey] = updatedProfile;

       const { password, ...userWithoutPassword } = updatedProfile;
       return { success: true, user: userWithoutPassword };
}


// Note: These stubs don't involve actual file I/O or bcrypt hashing suitable for RN.
// They purely simulate the expected behavior for the AuthContext demo.
