import { z } from "zod";

/** Shared by hosted operator authorization and runtime-secret provisioning. */
export const accessConfig = z.strictObject({
  issuer: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.origin === value &&
      url.protocol === "https:" &&
      url.hostname.endsWith(".cloudflareaccess.com")
    );
  }),
  audience: z.string().min(1),
  identities: z
    .array(
      z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("human"), email: z.email() }),
        z.strictObject({ kind: z.literal("machine"), clientId: z.string().min(1) }),
      ]),
    )
    .min(1),
});
