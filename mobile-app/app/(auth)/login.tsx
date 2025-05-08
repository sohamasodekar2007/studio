
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context'; // Adapted for RN
import { GraduationCap } from 'lucide-react-native'; // Use RN version
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { styled } from 'nativewind';

// Styled components using NativeWind
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledGraduationCap = styled(GraduationCap);

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

   const { control, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (initializationError) {
        alert(`System Error: ${initializationError}`); // Use native alert
        return;
    }
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      // Navigation handled by AuthContext or side effect after successful login
    } catch (error: any) {
       alert(`Login Failed: ${error.message}`); // Use native alert
    } finally {
      setIsLoading(false);
    }
  };

   const combinedLoading = isLoading || authLoading;

  return (
    <StyledView className="flex-1 items-center justify-center bg-background p-4">
      <StyledView className="w-full max-w-sm bg-card rounded-lg shadow-lg p-6">
        <StyledView className="items-center mb-6">
          <StyledGraduationCap className="text-primary" size={48} />
        </StyledView>
        <StyledText className="text-2xl font-bold text-center mb-2 text-foreground">Welcome Back!</StyledText>
        <StyledText className="text-muted-foreground text-center mb-6">Enter your details to log in.</StyledText>

        {/* Email Input */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <StyledView className="mb-4">
              <StyledText className="text-foreground mb-1">Email</StyledText>
              <StyledTextInput
                className="border border-input bg-input p-3 rounded-md text-foreground text-base"
                placeholder="m@example.com"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!combinedLoading}
              />
              {errors.email && <StyledText className="text-destructive mt-1 text-sm">{errors.email.message}</StyledText>}
            </StyledView>
          )}
        />

        {/* Password Input */}
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
             <StyledView className="mb-6">
               <StyledText className="text-foreground mb-1">Password</StyledText>
               <StyledTextInput
                 className="border border-input bg-input p-3 rounded-md text-foreground text-base"
                 placeholder="Password"
                 value={value}
                 onBlur={onBlur}
                 onChangeText={onChange}
                 secureTextEntry
                 editable={!combinedLoading}
               />
               {errors.password && <StyledText className="text-destructive mt-1 text-sm">{errors.password.message}</StyledText>}
             </StyledView>
          )}
        />

        {/* Login Button */}
        <StyledTouchableOpacity
          className={`w-full p-4 rounded-md flex-row justify-center items-center ${combinedLoading ? 'bg-primary/70' : 'bg-primary'}`}
          onPress={handleSubmit(onSubmit)}
          disabled={combinedLoading}
        >
           {combinedLoading && <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />}
          <StyledText className="text-primary-foreground text-base font-semibold">Log in</StyledText>
        </StyledTouchableOpacity>

        {/* Sign Up Link */}
        <StyledView className="flex-row justify-center mt-6">
          <StyledText className="text-muted-foreground text-sm">Don't have an account? </StyledText>
          <Link href="/(auth)/signup" asChild>
             <TouchableOpacity>
               <StyledText className="text-primary underline text-sm">Sign up</StyledText>
             </TouchableOpacity>
           </Link>
        </StyledView>
      </StyledView>
    </StyledView>
  );
}
