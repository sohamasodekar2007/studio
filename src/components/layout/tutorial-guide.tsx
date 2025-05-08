'use client';

import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import Joyride, { type Step, type CallBackProps, STATUS, EVENTS } from 'react-joyride';

interface TutorialGuideProps {
  run: boolean;
  steps: Step[];
  stepIndex: number;
  handleJoyrideCallback: (data: CallBackProps) => void; // Parent handles state logic
}

const TutorialGuide: React.FC<TutorialGuideProps> = ({ run, steps, stepIndex, handleJoyrideCallback }) => {
    const [isMounted, setIsMounted] = useState(false); // State to track client-side mount

    useEffect(() => {
        // This effect runs only on the client after the component mounts
        setIsMounted(true);
    }, []);

    // Render Joyride only after the component has mounted on the client
    if (!isMounted) {
        return null; // Render nothing on the server or during the initial client render before mount
    }

  return (
    <Joyride
      run={run}
      steps={steps}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback} // Directly pass the callback from parent
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      scrollToFirstStep={true} // Helps ensure the first step is visible
      disableScrolling={false} // Allow Joyride to scroll to targets
      floaterProps={{ disableAnimation: false }} // Ensure floater animations are enabled
      tooltipComponent={({
            continuous,
            index,
            step,
            backProps,
            closeProps,
            primaryProps,
            tooltipProps,
        }) => (
           <div {...tooltipProps} className="p-4 bg-card text-card-foreground rounded-lg shadow-lg border border-border max-w-xs">
            {step.title && <h4 className="font-bold text-lg mb-2">{step.title}</h4>}
            <div className="text-sm">{step.content}</div>
            <div className="flex justify-between items-center mt-4">
                 <button {...backProps} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                    Back
                 </button>
               {continuous && (
                <button {...primaryProps} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                   Next
                </button>
               )}
                {!continuous && (
                 <button {...primaryProps} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                    Close
                 </button>
                )}
            </div>
           </div>
        )}
      styles={{
        options: {
          //arrowColor: 'hsl(var(--card))', // Can customize if needed
          //backgroundColor: 'hsl(var(--card))',
          //overlayColor: 'rgba(0, 0, 0, 0.6)',
          primaryColor: 'hsl(var(--primary))', // Use theme primary color
          //textColor: 'hsl(var(--card-foreground))',
          zIndex: 1100, // Ensure it's above sidebar overlay if necessary
          //width: 350,
        },
        // Keep custom button styling or rely on default/component styling
        // buttonNext: {
        //   backgroundColor: 'hsl(var(--primary))',
        //    borderRadius: 'var(--radius)',
        // },
        //  buttonBack: {
        //    color: 'hsl(var(--muted-foreground))',
        // },
        //  buttonSkip: {
        //    color: 'hsl(var(--muted-foreground))',
        // },
      }}
    />
  );
};

export default TutorialGuide;
