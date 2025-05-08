
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context'; // Adapted for RN
import { GraduationCap, Phone } from 'lucide-react-native'; // Use RN version
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { academicStatuses } from '@/types'; // Import statuses from web types
import { styled } from 'nativewind';
// Simple Picker component for dropdown simulation (replace with a proper library if needed)
import { Picker } from '@react-native-picker/picker';

// Styled components
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledGraduationCap = styled(GraduationCap);
const StyledPhone = styled(Phone);
const StyledScrollView = styled(ScrollView);
const StyledPicker = styled(Picker);


const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your status." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const { signUp, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "", email: "", phoneNumber: "", academicStatus: undefined, password: "", confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    if (initializationError) {
      alert(`System Error: ${initializationError}`);
      return;
    }
    setIsLoading(true);
    try {
      await signUp(
        data.email,
        data.password,
        data.name,
        data.phoneNumber,
        data.academicStatus
      );
      // Navigation handled by AuthContext or side effect after successful signup
    } catch (error: any) {
       alert(`Sign Up Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading;

  return (
    <StyledScrollView contentContainerClassName="flex-grow justify-center" className="bg-background">
       <StyledView className="items-center justify-center p-4 ">
            <StyledView className="w-full max-w-md bg-card rounded-lg shadow-lg p-6">
                <StyledView className="items-center mb-6">
                <StyledGraduationCap className="text-primary" size={48} />
                </StyledView>
                <StyledText className="text-2xl font-bold text-center mb-2 text-foreground">Join STUDY SPHERE</StyledText>
                <StyledText className="text-muted-foreground text-center mb-6">Create your account.</StyledText>

                {/* Form Fields */}
                {/* Name */}
                <Controller name="name" control={control} render={({ field: { onChange, onBlur, value } }) => (
                    <StyledView className="mb-4">
                    <StyledText className="text-foreground mb-1">Full Name</StyledText>
                    <StyledTextInput className="border border-input bg-input p-3 rounded-md text-foreground" placeholder="Your Name" value={value} onBlur={onBlur} onChangeText={onChange} editable={!combinedLoading} />
                    {errors.name && <StyledText className="text-destructive mt-1 text-sm">{errors.name.message}</StyledText>}
                    </StyledView>
                )} />

                {/* Email */}
                 <Controller name="email" control={control} render={({ field: { onChange, onBlur, value } }) => (
                    <StyledView className="mb-4">
                    <StyledText className="text-foreground mb-1">Email</StyledText>
                    <StyledTextInput className="border border-input bg-input p-3 rounded-md text-foreground" placeholder="m@example.com" value={value} onBlur={onBlur} onChangeText={onChange} keyboardType="email-address" autoCapitalize="none" editable={!combinedLoading} />
                    {errors.email && <StyledText className="text-destructive mt-1 text-sm">{errors.email.message}</StyledText>}
                    </StyledView>
                )} />

                {/* Phone Number */}
                 <Controller name="phoneNumber" control={control} render={({ field: { onChange, onBlur, value } }) => (
                    <StyledView className="mb-4">
                    <StyledText className="text-foreground mb-1">Phone Number</StyledText>
                     <StyledView className="flex-row items-center border border-input bg-input rounded-md">
                         <StyledPhone className="text-muted-foreground mx-3" size={16}/>
                         <StyledTextInput className="flex-1 p-3 text-foreground" placeholder="9876543210" value={value} onBlur={onBlur} onChangeText={onChange} keyboardType="phone-pad" maxLength={10} editable={!combinedLoading} />
                    </StyledView>
                    {errors.phoneNumber && <StyledText className="text-destructive mt-1 text-sm">{errors.phoneNumber.message}</StyledText>}
                    </StyledView>
                )} />

                {/* Academic Status Picker */}
                <Controller
                    control={control}
                    name="academicStatus"
                    render={({ field: { onChange, value } }) => (
                         <StyledView className="mb-4 border border-input rounded-md">
                            <StyledPicker
                                selectedValue={value}
                                onValueChange={(itemValue) => onChange(itemValue)}
                                enabled={!combinedLoading}
                                style={{ height: 50, color: value ? '#000' : '#9ca3af' }} // Basic styling
                                >
                                <Picker.Item label="Select Academic Status *" value={undefined} color="#9ca3af"/>
                                {academicStatuses.map((status) => (
                                <Picker.Item key={status} label={status} value={status} />
                                ))}
                            </StyledPicker>
                         </StyledView>
                     )}
                 />
                 {errors.academicStatus && <StyledText className="text-destructive -mt-3 mb-3 text-sm">{errors.academicStatus.message}</StyledText>}


                 {/* Password */}
                  <Controller name="password" control={control} render={({ field: { onChange, onBlur, value } }) => (
                    <StyledView className="mb-4">
                    <StyledText className="text-foreground mb-1">Password</StyledText>
                    <StyledTextInput className="border border-input bg-input p-3 rounded-md text-foreground" placeholder="Password (min. 6 characters)" value={value} onBlur={onBlur} onChangeText={onChange} secureTextEntry editable={!combinedLoading} />
                    {errors.password && <StyledText className="text-destructive mt-1 text-sm">{errors.password.message}</StyledText>}
                    </StyledView>
                )} />

                 {/* Confirm Password */}
                 <Controller name="confirmPassword" control={control} render={({ field: { onChange, onBlur, value } }) => (
                    <StyledView className="mb-6">
                    <StyledText className="text-foreground mb-1">Confirm Password</StyledText>
                    <StyledTextInput className="border border-input bg-input p-3 rounded-md text-foreground" placeholder="Confirm Password" value={value} onBlur={onBlur} onChangeText={onChange} secureTextEntry editable={!combinedLoading} />
                    {errors.confirmPassword && <StyledText className="text-destructive mt-1 text-sm">{errors.confirmPassword.message}</StyledText>}
                    </StyledView>
                )} />

                 {/* Submit Button */}
                <StyledTouchableOpacity
                    className={`w-full p-4 rounded-md flex-row justify-center items-center ${combinedLoading ? 'bg-primary/70' : 'bg-primary'}`}
                    onPress={handleSubmit(onSubmit)}
                    disabled={combinedLoading}
                    >
                    {combinedLoading && <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />}
                    <StyledText className="text-primary-foreground text-base font-semibold">Sign Up</StyledText>
                </StyledTouchableOpacity>

                {/* Terms */}
                <StyledText className="text-center text-xs text-muted-foreground mt-4 px-4">
                  By clicking continue, you agree to our Terms of Service and Privacy Policy.
                </StyledText>

                {/* Login Link */}
                <StyledView className="flex-row justify-center mt-4">
                    <StyledText className="text-muted-foreground text-sm">Already have an account? </StyledText>
                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity>
                        <StyledText className="text-primary underline text-sm">Log in</StyledText>
                        </TouchableOpacity>
                    </Link>
                </StyledView>
            </StyledView>
        </StyledView>
    </StyledScrollView>
  );
}
