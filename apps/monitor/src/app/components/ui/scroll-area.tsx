"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

interface ScrollAreaContentProps {
  children: React.ReactNode;
  className?: string;
}

const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className }) => (
  <div className={cn("relative overflow-hidden", className)}>
    <div className="h-full w-full rounded-[inherit] overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
      {children}
    </div>
  </div>
);

const ScrollAreaContent: React.FC<ScrollAreaContentProps> = ({ children, className }) => (
  <div className={cn("h-full w-full", className)}>
    {children}
  </div>
);

export { ScrollArea, ScrollAreaContent }
