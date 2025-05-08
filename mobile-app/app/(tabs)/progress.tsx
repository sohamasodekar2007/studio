
import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function ProgressScreen() {
  return (
    <StyledView className="flex-1 justify-center items-center bg-background p-4">
      <StyledText className="text-xl font-bold text-foreground mb-4">My Progress</StyledText>
      <StyledText className="text-muted-foreground text-center">Test history and performance analysis will be displayed here.</StyledText>
      {/* TODO: Implement fetching and displaying test history */}
    </StyledView>
  );
}
