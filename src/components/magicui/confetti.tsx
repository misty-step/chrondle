"use client";

import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti";
import type { ReactNode } from "react";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { Button } from "@/components/ui/button";
import { ComponentProps } from "react";
import { logger } from "@/lib/logger";

type ButtonProps = ComponentProps<typeof Button>;

type Api = {
  fire: (options?: ConfettiOptions) => void;
};

type Props = React.ComponentPropsWithRef<"canvas"> & {
  options?: ConfettiOptions;
  globalOptions?: ConfettiGlobalOptions;
  manualstart?: boolean;
  children?: ReactNode;
};

export type ConfettiRef = Api | null;

const ConfettiContext = createContext<Api>({} as Api);

// Define component first
const ConfettiComponent = forwardRef<ConfettiRef, Props>((props, ref) => {
  const {
    options,
    globalOptions = { resize: true, useWorker: false },
    manualstart = false,
    children,
    ...rest
  } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);
  // Using unknown for dynamic import type
  const confettiRef = useRef<unknown>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement) => {
      if (node !== null) {
        if (instanceRef.current) return;

        // Dynamically import confetti only when canvas is ready
        if (!confettiRef.current) {
          import("canvas-confetti")
            .then(({ default: confettiLib }) => {
              confettiRef.current = confettiLib;

              try {
                instanceRef.current = (confettiRef.current as any).create(node, {
                  ...globalOptions,
                  resize: true,
                });
              } catch (error) {
                logger.warn("🎊 Could not load worker", error);
                // Fallback: try without worker if CSP blocks it
                try {
                  instanceRef.current = (confettiRef.current as any).create(node, {
                    ...globalOptions,
                    resize: true,
                    useWorker: false,
                  });
                } catch (fallbackError) {
                  logger.error("🎊 Confetti initialization failed completely", fallbackError);
                }
              }
            })
            .catch((error) => {
              logger.error("🎊 Failed to load confetti library", error);
            });
        } else {
          // Confetti already loaded, create instance
          try {
            instanceRef.current = (confettiRef.current as any).create(node, {
              ...globalOptions,
              resize: true,
            });
          } catch (error) {
            logger.warn("🎊 Could not load worker", error);
            // Fallback: try without worker if CSP blocks it
            try {
              instanceRef.current = (confettiRef.current as any).create(node, {
                ...globalOptions,
                resize: true,
                useWorker: false,
              });
            } catch (fallbackError) {
              logger.error("🎊 Confetti initialization failed completely", fallbackError);
            }
          }
        }
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset();
          instanceRef.current = null;
        }
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    async (opts = {}) => {
      try {
        await instanceRef.current?.({ ...options, ...opts });
      } catch (error) {
        logger.error("Confetti error:", error);
      }
    },
    [options],
  );

  const api = useMemo(
    () => ({
      fire,
    }),
    [fire],
  );

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) {
      (async () => {
        try {
          await fire();
        } catch (error) {
          logger.error("Confetti effect error:", error);
        }
      })();
    }
  }, [manualstart, fire]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  );
});

// Set display name immediately
ConfettiComponent.displayName = "Confetti";

// Export as Confetti
export const Confetti = ConfettiComponent;

interface ConfettiButtonProps extends ButtonProps {
  options?: ConfettiOptions & ConfettiGlobalOptions & { canvas?: HTMLCanvasElement };
  children?: React.ReactNode;
}

const ConfettiButtonComponent = ({ options, children, ...props }: ConfettiButtonProps) => {
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Dynamically import confetti for button click
      const { default: confettiLib } = await import("canvas-confetti");
      await confettiLib({
        ...options,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
      });
    } catch (error) {
      logger.error("Confetti button error:", error);
    }
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
};

ConfettiButtonComponent.displayName = "ConfettiButton";

export const ConfettiButton = ConfettiButtonComponent;
