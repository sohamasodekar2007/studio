// src/actions/referral-offers-actions.ts
'use server';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ReferralOffer } from '@/types';

const offersFilePath = path.join(process.cwd(), 'src', 'data', 'referral-offers.json');
const dataDir = path.join(process.cwd(), 'src', 'data');

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function readOffersFile(): Promise<ReferralOffer[]> {
  try {
    await ensureDirExists(dataDir);
    const fileContent = await fs.readFile(offersFilePath, 'utf-8');
    return JSON.parse(fileContent) as ReferralOffer[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array (and optionally create it)
      await fs.writeFile(offersFilePath, JSON.stringify([]), 'utf-8');
      return [];
    }
    console.error('Failed to read referral offers file:', error);
    return []; // Return empty on other errors
  }
}

async function writeOffersFile(offers: ReferralOffer[]): Promise<boolean> {
  try {
    await ensureDirExists(dataDir);
    await fs.writeFile(offersFilePath, JSON.stringify(offers, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write referral offers file:', error);
    return false;
  }
}

export async function getReferralOffers(activeOnly: boolean = false): Promise<ReferralOffer[]> {
  const offers = await readOffersFile();
  if (activeOnly) {
    const now = new Date().toISOString();
    return offers.filter(offer => offer.isActive && (!offer.expiryDate || offer.expiryDate > now));
  }
  return offers.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
}

export async function createReferralOffer(
  offerData: Omit<ReferralOffer, 'id' | 'createdAt'>
): Promise<{ success: boolean; offer?: ReferralOffer; message?: string }> {
  try {
    const newOffer: ReferralOffer = {
      ...offerData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    const offers = await readOffersFile();
    offers.push(newOffer);
    const success = await writeOffersFile(offers);
    if (success) {
      return { success: true, offer: newOffer };
    } else {
      return { success: false, message: "Failed to save new referral offer." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Could not create referral offer." };
  }
}

export async function updateReferralOffer(
  offerId: string,
  updatedData: Partial<Omit<ReferralOffer, 'id' | 'createdAt'>>
): Promise<{ success: boolean; offer?: ReferralOffer; message?: string }> {
  try {
    let offers = await readOffersFile();
    const offerIndex = offers.findIndex(o => o.id === offerId);
    if (offerIndex === -1) {
      return { success: false, message: "Referral offer not found." };
    }
    const updatedOffer = { ...offers[offerIndex], ...updatedData };
    offers[offerIndex] = updatedOffer;
    const success = await writeOffersFile(offers);
    if (success) {
      return { success: true, offer: updatedOffer };
    } else {
      return { success: false, message: "Failed to update referral offer." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Could not update referral offer." };
  }
}

export async function deleteReferralOffer(offerId: string): Promise<{ success: boolean; message?: string }> {
  try {
    let offers = await readOffersFile();
    const initialLength = offers.length;
    offers = offers.filter(o => o.id !== offerId);
    if (offers.length === initialLength) {
        return { success: false, message: "Referral offer not found."};
    }
    const success = await writeOffersFile(offers);
    if (success) {
      return { success: true };
    } else {
      return { success: false, message: "Failed to delete referral offer." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Could not delete referral offer." };
  }
}