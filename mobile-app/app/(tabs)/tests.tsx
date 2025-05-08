
import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function TestsScreen() {
  return (
    <StyledView className="flex-1 justify-center items-center bg-background p-4">
      <StyledText className="text-xl font-bold text-foreground mb-4">Test Series</StyledText>
      <StyledText className="text-muted-foreground text-center">Test listing and filtering will be implemented here.</StyledText>
      {/* TODO: Implement test listing, filtering, etc. */}
    </StyledView>
  );
}
