
import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function NotebooksScreen() {
  return (
    <StyledView className="flex-1 justify-center items-center bg-background p-4">
      <StyledText className="text-xl font-bold text-foreground mb-4">My Notebooks</StyledText>
      <StyledText className="text-muted-foreground text-center">Notebook creation and viewing saved questions will be implemented here.</StyledText>
      {/* TODO: Implement Notebook listing, creation, viewing bookmarks */}
    </StyledView>
  );
}
