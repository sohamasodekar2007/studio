// src/components/layout/tutorial-modal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tutorialSteps = [
  {
    title: "Welcome to EduNexus!",
    content: "This quick tutorial will guide you through the main features of the platform. Click 'Next' to begin.",
    target: null, // General welcome
  },
  {
    title: "Dashboard",
    content: "This is your main hub. Here you can quickly access Test Series, Daily Practice Problems (DPP), view your Progress, and use AI Tools.",
    target: "/",
  },
  {
    title: "Test Series",
    content: "Browse and take chapter-wise or full-length mock tests for MHT-CET, JEE, and NEET. Filter tests based on your exam and plan.",
    target: "/tests",
  },
  {
    title: "Daily Practice Problems (DPP)",
    content: "Sharpen your skills daily by solving chapter-specific problems. Select a subject and lesson to get started.",
    target: "/dpp",
  },
  {
    title: "Notebooks",
    content: "Save important or tricky questions from DPPs into custom notebooks for easy review and revision later.",
    target: "/notebooks",
  },
  {
    title: "My Progress",
    content: "Track your performance history for all attempted tests. Review your answers and analyze your results here.",
    target: "/progress",
  },
    {
    title: "AI Tools (Premium)",
    content: "Get personalized Study Tips for difficult topics or use the AI Doubt Solving feature to get instant help with questions.",
    target: "/study-tips", // or /doubt-solving
  },
    {
    title: "Friends & Leaderboard",
    content: "Connect with friends, compare performance (premium), and check your ranking on the global leaderboard based on points earned.",
    target: "/leaderboard", // or /find-friends
  },
  {
    title: "Settings & Profile",
    content: "Manage your profile details, change your password, and view your subscription status on the Settings page.",
    target: "/settings",
  },
  {
    title: "Navigation Complete!",
    content: "You've seen the main areas. Explore the platform and start practicing!",
    target: null, // End
  },
];

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose(); // Close on the last step
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Reset step when dialog is closed externally
  useState(() => {
      if (!isOpen) {
          setCurrentStep(0);
      }
  });


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {tutorialSteps.length}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <Progress value={progress} className="w-full h-2" />
           <p className="text-sm text-muted-foreground min-h-[60px]">
             {step.content}
           </p>
           {/* Optional: Add image or highlight based on step.target later */}
        </div>
        <DialogFooter className="flex justify-between w-full">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          {currentStep === tutorialSteps.length - 1 ? (
             <Button onClick={onClose}>
                <Check className="mr-2 h-4 w-4" /> Finish
            </Button>
          ) : (
            <Button onClick={handleNext}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
