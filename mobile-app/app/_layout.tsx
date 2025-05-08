
import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/auth-context'; // Assuming auth context is adapted for RN
import { ActivityIndicator, View, Text } from 'react-native'; // Use RN components

function RootLayoutNav() {
  const { user, loading, initializationError } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

   if (initializationError) {
     return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
         <Text style={{ color: 'red', textAlign: 'center' }}>Error: {initializationError}</Text>
       </View>
     );
   }

  // Determine initial route based on auth state
  const initialRouteName = user ? '(tabs)' : '(auth)/login';

  return (
    <Stack initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* Add other stack screens like test interface here later */}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
