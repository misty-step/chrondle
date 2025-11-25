"use client";

import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Celebration } from "@/components/ui/Celebration";
import { ANIMATION_DURATIONS } from "@/lib/animationConstants";

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: string;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
  achievement,
}) => {
  // Auto-close after 4 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, ANIMATION_DURATIONS.ACHIEVEMENT_MODAL_AUTO_CLOSE);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  // Trigger celebration when modal opens
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent("chrondle:celebrate"));
    }
  }, [isOpen]);

  return (
    <>
      <Celebration />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[85vh] w-11/12 overflow-y-auto sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Achievement Unlocked</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4 text-center">
            <div className="mb-4 animate-bounce text-6xl">🏆</div>
            <h2 className="text-foreground mb-2 text-2xl font-bold">Achievement Unlocked!</h2>
            <p className="text-body-primary mb-6 text-lg font-medium">{achievement}</p>
            <Button
              onClick={onClose}
              className="px-6 py-3 font-medium transition-all duration-200 hover:scale-105"
              autoFocus
            >
              Awesome!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
