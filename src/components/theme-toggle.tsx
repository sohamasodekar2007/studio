'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
     <TooltipProvider disableHoverableContent>
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8" // Slightly smaller for sidebar fit
                    onClick={toggleTheme}
                  >
                    <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
             </TooltipTrigger>
             <TooltipContent side="right" sideOffset={15}>
                Toggle theme
             </TooltipContent>
        </Tooltip>
    </TooltipProvider>
  );
}
