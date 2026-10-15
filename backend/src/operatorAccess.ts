/** Operator authorization is separate from the game's Clerk identities. */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AuthVerifier } from "./engine/auth";

const accessConfig = z.strictObject({
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

type Settings = {
  ENVIRONMENT?: string;
  BACKEND_ADMIN_TOKEN?: string;
  /** Exact Access issuer, audience and kind-tagged human/machine identities. */
  BACKEND_OPERATOR_ACCESS?: string;
};

export class OperatorAccess {
  private readonly access: {
    verifier: AuthVerifier;
    identities: z.infer<typeof accessConfig>["identities"];
  } | null;

  constructor(private readonly env: Settings) {
    this.access = null;
    if (env.BACKEND_OPERATOR_ACCESS) {
      try {
        const config = accessConfig.parse(JSON.parse(env.BACKEND_OPERATOR_ACCESS));
        this.access = {
          verifier: new AuthVerifier([
            {
              type: "customJwt",
              issuer: config.issuer,
              jwks: `${config.issuer}/cdn-cgi/access/certs`,
              applicationID: config.audience,
              algorithm: "RS256",
            },
          ]),
          identities: config.identities,
        };
      } catch {
        // Fail closed without logging operator identities or configuration contents.
      }
    }
  }

  async allows(request: Request): Promise<boolean> {
    // The bearer interface is only a loopback development tool, never a hosted fallback.
    if (this.env.ENVIRONMENT === "development") {
      const hostname = new URL(request.url).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return false;
      const expected = this.env.BACKEND_ADMIN_TOKEN;
      const given = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
      if (!expected || !given) return false;
      return timingSafeEqual(
        createHash("sha256").update(expected).digest(),
        createHash("sha256").update(given).digest(),
      );
    }
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!this.access || !token) return false;
    try {
      // Access service tokens have sub=""; only this consumer opts in, and only
      // a signed, exact pinned ClientID below may authorize that token shape.
      const { identity, expiresAt } = await this.access.verifier.verify(token, {
        allowEmptySubject: true,
      });
      if (expiresAt <= Date.now() || identity.type !== "app") return false;
      return this.access.identities.some((allowed) =>
        allowed.kind === "machine"
          ? identity.subject === "" && identity.common_name === allowed.clientId
          : identity.subject !== "" && identity.email === allowed.email,
      );
    } catch {
      return false;
    }
  }
}
