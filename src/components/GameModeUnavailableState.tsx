import { GameModeLayout } from "@/components/GameModeLayout";
import { ModeUnavailableState } from "@/components/ModeUnavailableState";

interface GameModeUnavailableStateProps {
  mode: "classic" | "order" | "groups";
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function GameModeUnavailableState({
  mode,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: GameModeUnavailableStateProps) {
  return (
    <GameModeLayout mode={mode}>
      <div className="flex flex-1 items-center px-4">
        <ModeUnavailableState
          title={title}
          description={description}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          secondaryHref={secondaryHref}
          secondaryLabel={secondaryLabel}
          className="my-auto"
        />
      </div>
    </GameModeLayout>
  );
}
