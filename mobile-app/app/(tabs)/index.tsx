
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { useAuth } from '@/context/auth-context';
import { ListChecks, ClipboardList, Activity, Wand2, MessageSquare, ArrowRight } from 'lucide-react-native';
import { Link } from 'expo-router';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

const Card = ({ title, description, icon: Icon, link, linkText, accentColor = 'primary' }: { title: string, description: string, icon: React.ElementType, link: string, linkText: string, accentColor?: string }) => (
  <StyledView className="bg-card rounded-lg shadow p-4 border border-border mb-4">
    <StyledView className="flex-row items-center justify-between mb-2">
      <StyledText className="text-base font-semibold text-card-foreground">{title}</StyledText>
      <Icon className={`text-${accentColor}`} size={20} />
    </StyledView>
    <StyledText className="text-sm text-muted-foreground mb-3">{description}</StyledText>
    <Link href={link as any} asChild>
      <StyledTouchableOpacity className={`border border-${accentColor}/50 rounded-md p-2 flex-row items-center justify-center bg-${accentColor}/10`}>
        <StyledText className={`text-${accentColor} font-medium text-sm`}>{linkText}</StyledText>
        <ArrowRight className={`text-${accentColor} ml-1`} size={16} />
      </StyledTouchableOpacity>
    </Link>
  </StyledView>
);

export default function DashboardScreen() {
  const { user } = useAuth();

  return (
    <StyledScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      <StyledText className="text-2xl font-bold text-foreground mb-2">Welcome{user?.name ? `, ${user.name}` : ''}!</StyledText>
      <StyledText className="text-muted-foreground mb-6">Your ExamPrep Hub Dashboard.</StyledText>

      <StyledView className="grid grid-cols-1 gap-4">
        <Card
          title="Browse Test Series"
          description="Explore full syllabus and chapter-wise tests."
          icon={ListChecks}
          link="/(tabs)/tests"
          linkText="View All Tests"
          accentColor="primary"
        />
        <Card
          title="Daily Practice (DPP)"
          description="Sharpen skills with daily chapter problems."
          icon={ClipboardList}
          link="/(tabs)/dpp"
          linkText="Start DPP"
          accentColor="accent" // Purple
        />
         <Card
           title="My Notebooks"
           description="Access your saved questions and notes."
           icon={Activity} // Using Notebook icon now
           link="/(tabs)/notebooks" // Link to notebooks tab
           linkText="View Notebooks"
           accentColor="blue-600" // Example color
         />
        <Card
          title="My Progress"
          description="Track your test attempts and performance."
          icon={Activity}
          link="/(tabs)/progress"
          linkText="View History"
          accentColor="green-600" // Green
        />

        {/* AI Tool Placeholders - Add later if needed */}
        {/* <Card
          title="AI Study Tips"
          description="Get personalized tips for tricky topics."
          icon={Wand2}
          link="/study-tips" // Placeholder link
          linkText="Get Tips"
          accentColor="purple-600"
        />
        <Card
          title="AI Doubt Solving"
          description="Instant answers to your academic questions."
          icon={MessageSquare}
          link="/doubt-solving" // Placeholder link
          linkText="Ask EduNexus"
          accentColor="blue-600"
        /> */}
      </StyledView>

      {/* Add other sections like Recent Activity or Performance Snapshot later */}

    </StyledScrollView>
  );
}
