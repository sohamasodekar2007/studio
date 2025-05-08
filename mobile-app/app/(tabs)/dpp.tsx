
import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function DppScreen() {
  return (
    <StyledView className="flex-1 justify-center items-center bg-background p-4">
      <StyledText className="text-xl font-bold text-foreground mb-4">Daily Practice Problems (DPP)</StyledText>
      <StyledText className="text-muted-foreground text-center">DPP subject/lesson selection will be implemented here.</StyledText>
      {/* TODO: Implement DPP listing and navigation */}
    </StyledView>
  );
}
