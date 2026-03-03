"use client";

interface LoadErrorStateProps {
  title: string;
  message: string;
  recoverability: "recoverable" | "unrecoverable";
  onRetry: () => void;
}

export function LoadErrorState({ title, message, recoverability, onRetry }: LoadErrorStateProps) {
  const isRecoverable = recoverability === "recoverable";

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="bg-destructive/10 text-destructive max-w-md rounded p-6 text-center">
        <h2 className="mb-2 text-xl font-bold">{title}</h2>
        <p className="mb-4">{message}</p>
        <p className="mb-4 text-sm">
          {isRecoverable
            ? "Temporary failure detected. Retrying may recover this session."
            : "This issue may require a full page reload to recover."}
        </p>
        <button
          onClick={onRetry}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-4 py-2 transition-colors"
        >
          {isRecoverable ? "Retry" : "Reload Page"}
        </button>
      </div>
    </div>
  );
}
