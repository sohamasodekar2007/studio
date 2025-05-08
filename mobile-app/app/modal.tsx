
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function Modal() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Modal', presentation: 'modal' }} />
      <Text>Modal Screen</Text>
    </View>
  );
}
