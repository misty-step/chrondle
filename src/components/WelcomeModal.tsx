"use client";

import { Crown, Calendar, Target, Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WelcomeModalProps {
  open: boolean;
  onDismiss: () => void;
}

export const WELCOME_SEEN_KEY = "chrondle_seen_welcome";

export function WelcomeModal({ open, onDismiss }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="text-center sm:text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-sm">
            <Crown className="text-primary size-6" />
          </div>
          <DialogTitle className="font-display text-2xl text-balance">
            Test Your History Knowledge
          </DialogTitle>
          <DialogDescription className="text-base text-pretty">
            Six clues. One year. Daily puzzles from ancient empires to pop culture.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-sm">
              <Calendar className="text-muted-foreground size-4" />
            </div>
            <p className="text-muted-foreground text-sm">A new puzzle every day at midnight</p>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-sm">
              <Lightbulb className="text-muted-foreground size-4" />
            </div>
            <p className="text-muted-foreground text-sm">
              Reveal hints one by one to narrow down the year
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-sm">
              <Target className="text-muted-foreground size-4" />
            </div>
            <p className="text-muted-foreground text-sm">Fewer hints used means a higher score</p>
          </div>
        </div>

        <Button onClick={onDismiss} className="w-full" size="lg">
          Start Playing
        </Button>
      </DialogContent>
    </Dialog>
  );
}
