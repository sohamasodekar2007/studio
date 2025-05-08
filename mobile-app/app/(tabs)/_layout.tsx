
import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ListChecks, ClipboardCheck, Activity, MessageSquare, Wand2, Notebook } from 'lucide-react-native'; // Use RN icons
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false, // Hide default header for tabs
        tabBarActiveTintColor: 'hsl(240 60% 55%)', // primary color
        tabBarInactiveTintColor: 'hsl(220 10% 45%)', // muted-foreground
        tabBarStyle: {
           backgroundColor: 'hsl(220 20% 100%)', // card background (light)
           borderTopColor: 'hsl(220 15% 88%)', // border color
           // Add dark mode styles if needed
           height: Platform.OS === 'android' ? 60 : 80, // Adjust height for platform
           paddingBottom: Platform.OS === 'android' ? 5 : 25, // Adjust padding
        },
        tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: Platform.OS === 'android' ? 0 : -10, // Adjust label position
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: React.ComponentType<any> = Home; // Default icon

          if (route.name === 'index') { // Matches index.tsx in (tabs)
            iconName = Home;
          } else if (route.name === 'tests') {
            iconName = ListChecks;
          } else if (route.name === 'dpp') {
            iconName = ClipboardCheck;
           } else if (route.name === 'notebooks') {
            iconName = Notebook;
          } else if (route.name === 'progress') {
            iconName = Activity;
           } else if (route.name === 'doubt-solving') {
             iconName = MessageSquare;
           } else if (route.name === 'study-tips') {
             iconName = Wand2;
           }

          const IconComponent = iconName;
          return <IconComponent size={focused ? 26 : 24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="tests" options={{ title: 'Tests' }} />
      <Tabs.Screen name="dpp" options={{ title: 'DPP' }} />
       <Tabs.Screen name="notebooks" options={{ title: 'Notebooks' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
       {/* Add AI tools later
       <Tabs.Screen name="doubt-solving" options={{ title: 'Doubt Solving' }} />
       <Tabs.Screen name="study-tips" options={{ title: 'Study Tips' }} />
       */}
    </Tabs>
  );
}
