'use client';

import React from 'react';
import Joyride, { type Step, type CallBackProps, STATUS } from 'react-joyride';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar'; // Import useSidebar

interface TutorialGuideProps {
  run: boolean;
  steps: Step[];
  stepIndex: number;
  handleJoyrideCallback: (data: CallBackProps) => void;
}

const TutorialGuide: React.FC<TutorialGuideProps> = ({ run, steps, stepIndex, handleJoyrideCallback }) => {
    const router = useRouter();
    const { setOpen: setSidebarOpen } = useSidebar(); // Get sidebar control

    const handleCallback = (data: CallBackProps) => {
        const { status, index, step, type } = data;

        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            // Reset state in the parent component via callback
             handleJoyrideCallback(data);
            return;
        }

        // Handle navigation for specific steps if needed
        if (type === 'step:after') {
            // Check if the step has a target URL for navigation
            const targetUrl = (step.data as any)?.url;
             if (targetUrl) {
                // Ensure sidebar is open before navigating to highlight target
                 setSidebarOpen(true);
                setTimeout(() => {
                     router.push(targetUrl);
                     // You might need to manually advance the step here after navigation
                     // or handle it in the parent component's callback
                }, 300); // Small delay for sidebar animation
            }
        }

        // Pass the callback data to the parent component
        handleJoyrideCallback(data);
    };


  return (
    <Joyride
      run={run}
      steps={steps}
      stepIndex={stepIndex}
      callback={handleCallback}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      scrollToFirstStep={true}
      styles={{
        options: {
          arrowColor: 'hsl(var(--card))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          primaryColor: 'hsl(var(--primary))', // Use theme primary color
          textColor: 'hsl(var(--card-foreground))',
          zIndex: 1000,
          width: 350,
        },
        tooltipContainer: {
           textAlign: 'left',
        },
         tooltipContent: {
           padding: '15px',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
           borderRadius: 'var(--radius)',
        },
         buttonBack: {
           color: 'hsl(var(--muted-foreground))',
        },
         buttonSkip: {
           color: 'hsl(var(--muted-foreground))',
        },
      }}
    />
  );
};

export default TutorialGuide;
