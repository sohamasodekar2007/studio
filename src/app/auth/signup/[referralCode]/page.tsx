// src/app/auth/signup/[referralCode]/page.tsx
'use client';

// This page component will effectively be the same as the main signup page,
// but it ensures that Next.js registers this dynamic route.
// The actual logic for pre-filling the referral code is handled within the
// main SignupPage component using `useSearchParams`.

import SignupPage from '../page'; // Import the main signup page component

export default function SignupWithReferralPage() {
  // The `useSearchParams` hook in the imported SignupPage will
  // read the `referralCode` from the URL if present.
  return <SignupPage />;
}
