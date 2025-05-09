// src/actions/settings-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { PlatformSettings } from '@/types';

const settingsFilePath = path.join(process.cwd(), 'src', 'data', 'platform-settings.json');

// Helper function to ensure directory exists
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }
}

/**
 * Retrieves the current platform settings.
 * Returns default settings if the file doesn't exist or is invalid.
 * @returns A promise resolving to the PlatformSettings object.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const defaultSettings: PlatformSettings = {
    maintenanceModeEnabled: false,
    newRegistrationsOpen: true,
    defaultTestAccess: 'FREE', // Changed to PricingType
    enableEmailNotifications: true,
    enableInAppNotifications: true,
  };

  try {
    await ensureDirExists(path.dirname(settingsFilePath));
    const fileContent = await fs.readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(fileContent) as PlatformSettings;
    // Merge with defaults to ensure all keys are present
    return { ...defaultSettings, ...settings };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, try to write default settings and return them
      console.warn(`Platform settings file not found at ${settingsFilePath}. Creating with defaults.`);
      try {
        await fs.writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
        return defaultSettings;
      } catch (writeError) {
        console.error('Failed to write default platform settings:', writeError);
        // Return default settings anyway on write failure
        return defaultSettings;
      }
    }
    console.error('Error reading platform settings:', error);
    // Return default settings on other errors
    return defaultSettings;
  }
}

/**
 * Updates the platform settings.
 * @param newSettings - The PlatformSettings object with new values.
 * @returns A promise resolving to true on success, false on failure.
 */
export async function updatePlatformSettings(newSettings: PlatformSettings): Promise<boolean> {
  try {
    await ensureDirExists(path.dirname(settingsFilePath));
    // Validate or sanitize newSettings if necessary before writing
    await fs.writeFile(settingsFilePath, JSON.stringify(newSettings, null, 2), 'utf-8');
    console.log('Platform settings updated successfully.');
    return true;
  } catch (error) {
    console.error('Failed to write platform settings:', error);
    return false;
  }
}
