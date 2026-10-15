/**
 * Verifies client JWTs the way Convex does for `convex/auth.config.ts`:
 * OIDC providers ({ domain, applicationID }) via discovery + JWKS, and
 * `customJwt` providers ({ issuer, jwks, algorithm, applicationID? }).
 * The resulting identity mirrors Convex's `UserIdentity`, including custom
 * claims such as Clerk's `public_metadata`.
 */
import type { JSONValue } from "convex/values";
import { z } from "zod";
import type { Identity } from "./engine";

/** `code` follows Convex's HTTP auth error codes (e.g. InvalidAuthHeader). */
export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Jwk = JsonWebKey & { kid?: string; alg?: string };

export const authProviderSchema = z.union([
  z.object({ domain: z.url(), applicationID: z.string().min(1), type: z.undefined().optional() }),
  z.object({
    type: z.literal("customJwt"),
    issuer: z.url(),
    jwks: z.url(),
    algorithm: z.enum(["RS256", "ES256"]),
    applicationID: z.string().min(1).optional(),
  }),
]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

type KeyCache = {
  keys: Jwk[];
  // Public IDs only: no-store still revalidates real users without letting
  // unknown IDs bypass the refresh cooldown. Never retain no-store key material.
  knownKids: Set<string | undefined>;
  expiresAt: number;
  staleUntil: number;
  refreshAfter: number;
  retryAfter: number;
  pending?: Promise<Jwk[]>;
};

const STANDARD_CLAIMS: Record<string, string> = {
  name: "name",
  given_name: "givenName",
  family_name: "familyName",
  nickname: "nickname",
  preferred_username: "preferredUsername",
  profile: "profileUrl",
  picture: "pictureUrl",
  email: "email",
  email_verified: "emailVerified",
  gender: "gender",
  birthdate: "birthday",
  zoneinfo: "timezone",
  locale: "language",
  phone_number: "phoneNumber",
  phone_number_verified: "phoneNumberVerified",
  address: "address",
  updated_at: "updatedAt",
};
const REGISTERED_CLAIMS = new Set(["iss", "sub", "aud", "exp", "nbf", "iat", "jti"]);
const KEY_TTL_MS = 10 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 30_000;
const STALE_IF_ERROR_MS = 5 * 60_000;
const CLOCK_SKEW_SECONDS = 5;

/** Respect origin freshness (including Age); never extend an explicit expiry. */
function cachePolicy(response: Response) {
  const control = response.headers.get("Cache-Control")?.toLowerCase() ?? "";
  const seconds = (name: string) => {
    const match = control.match(new RegExp(`(?:^|,)\\s*${name}\\s*=\\s*"?(\\d+)"?(?:\\s*,|$)`));
    return match ? Number(match[1]) : undefined;
  };
  const noStore = /(?:^|,)\s*no-store\s*(?:,|$)/.test(control);
  const revalidate = noStore || /(?:^|,)\s*(?:no-cache|must-revalidate)\s*(?:,|$)/.test(control);
  const age = Math.max(0, Number(response.headers.get("Age")) || 0) * 1000;
  const ttl =
    /(?:^|,)\s*no-cache\s*(?:,|$)/.test(control) || noStore
      ? 0
      : Math.max(0, Math.min((seconds("max-age") ?? KEY_TTL_MS / 1000) * 1000, 86_400_000) - age);
  return {
    ttl,
    stale: revalidate
      ? 0
      : Math.min((seconds("stale-if-error") ?? STALE_IF_ERROR_MS / 1000) * 1000, STALE_IF_ERROR_MS),
    store: !noStore,
  };
}

function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
  const padded = segment
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type VerifiedToken = { identity: Identity; expiresAt: number };

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** `jwks` may be a data URI, as Convex allows for customJwt providers. */
function decodeDataUri(uri: string): string {
  const comma = uri.indexOf(",");
  const meta = uri.slice("data:".length, comma);
  const payload = uri.slice(comma + 1);
  return meta.split(";").includes("base64")
    ? new TextDecoder().decode(base64Decode(payload))
    : decodeURIComponent(payload);
}

function base64Decode(text: string): Uint8Array {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export class AuthVerifier {
  // Bounded by configured providers, never by attacker-controlled kid strings.
  private keys = new Map<AuthProvider, KeyCache>();

  constructor(
    private readonly providers: AuthProvider[],
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {}

  private async keysFor(provider: AuthProvider, kid: string | undefined): Promise<Jwk[]> {
    let cached = this.keys.get(provider);
    if (!cached) {
      cached = {
        keys: [],
        knownKids: new Set(),
        expiresAt: 0,
        staleUntil: 0,
        refreshAfter: 0,
        retryAfter: 0,
      };
      this.keys.set(provider, cached);
    }
    const hasKid = cached.keys.some((key) => kid === undefined || key.kid === kid);
    const knownKid = kid === undefined ? cached.knownKids.size > 0 : cached.knownKids.has(kid);
    if (hasKid && this.now() < cached.expiresAt) return cached.keys;
    try {
      if (cached.pending) return await cached.pending;
      if (this.now() < cached.retryAfter || (!knownKid && this.now() < cached.refreshAfter))
        throw new AuthError("Unauthenticated", "Signing key refresh is cooling down");
      cached.refreshAfter = this.now() + REFRESH_COOLDOWN_MS;
      const entry = cached;
      entry.pending = this.refresh(provider)
        .then(({ keys, policy }) => {
          entry.keys = policy.store ? keys : [];
          entry.knownKids = new Set(keys.map((key) => key.kid));
          entry.expiresAt = this.now() + policy.ttl;
          entry.staleUntil = entry.expiresAt + policy.stale;
          entry.retryAfter = 0;
          return keys;
        })
        .catch((error: unknown) => {
          entry.retryAfter = this.now() + REFRESH_COOLDOWN_MS;
          throw error;
        })
        .finally(() => {
          entry.pending = undefined;
        });
      return await entry.pending;
    } catch (error) {
      // Only an already-known key, for a bounded outage grace. Never extend it
      // on failure, and never revive a key removed by a successful rotation.
      if (hasKid && this.now() < cached.staleUntil) return cached.keys;
      throw error;
    }
  }

  private async fetchKeys(url: string): Promise<Response> {
    const response = await this.fetchFn(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok)
      throw new AuthError("Unauthenticated", `Signing key provider failed: ${response.status}`);
    return response;
  }

  private async refresh(provider: AuthProvider) {
    let url: string;
    let discoveryPolicy: ReturnType<typeof cachePolicy> | undefined;
    if (provider.type === "customJwt") url = provider.jwks;
    else {
      const discovery = await this.fetchKeys(
        `${trimSlash(provider.domain)}/.well-known/openid-configuration`,
      );
      const config = z.object({ jwks_uri: z.url() }).parse(await discovery.json());
      url = config.jwks_uri;
      discoveryPolicy = cachePolicy(discovery);
    }
    const response = url.startsWith("data:")
      ? new Response(decodeDataUri(url))
      : await this.fetchKeys(url);
    const body = z
      .object({
        keys: z.array(
          z
            .object({
              kty: z.string(),
              kid: z.string().optional(),
              alg: z.string().optional(),
            })
            .passthrough(),
        ),
      })
      .parse(await response.json());
    const ids = body.keys.flatMap((key) => (key.kid === undefined ? [] : [key.kid]));
    if (new Set(ids).size !== ids.length)
      throw new AuthError("Unauthenticated", "Ambiguous signing keys");
    const policy = cachePolicy(response);
    if (discoveryPolicy) {
      policy.ttl = Math.min(policy.ttl, discoveryPolicy.ttl);
      policy.stale = Math.min(policy.stale, discoveryPolicy.stale);
      policy.store &&= discoveryPolicy.store;
    }
    return { keys: body.keys as Jwk[], policy };
  }

  async verify(token: string): Promise<VerifiedToken> {
    const parts = token.split(".");
    const unparseable =
      "Could not parse JWT payload. Check that the token is a valid JWT format with three base64-encoded parts separated by dots.";
    if (parts.length !== 3) throw new AuthError("InvalidAuthHeader", unparseable);
    let header: { alg?: string; kid?: string };
    let claims: Record<string, JSONValue>;
    try {
      header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
      claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    } catch {
      throw new AuthError("InvalidAuthHeader", unparseable);
    }
    const issuer = typeof claims.iss === "string" ? claims.iss : "";
    const provider = this.providers.find((candidate) =>
      candidate.type === "customJwt"
        ? candidate.issuer === issuer
        : trimSlash(candidate.domain) === trimSlash(issuer),
    );
    if (!provider)
      throw new AuthError(
        "NoAuthProvider",
        `No auth provider found matching the given token (issuer ${issuer || "missing"})`,
      );

    const applicationID = provider.applicationID;
    if (applicationID !== undefined) {
      const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audience.includes(applicationID))
        throw new AuthError(
          "Unauthenticated",
          "Token audience does not match the provider applicationID",
        );
    }
    const algorithm = provider.type === "customJwt" ? provider.algorithm : "RS256";
    if (header.alg !== algorithm)
      throw new AuthError("Unauthenticated", `Unsupported JWT algorithm ${header.alg}`);

    const nowSeconds = this.now() / 1000;
    if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds)
      throw new AuthError("Unauthenticated", "Token expired");
    if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > nowSeconds)
      throw new AuthError("Unauthenticated", "Token not yet valid");
    if (typeof claims.sub !== "string" || claims.sub.length === 0)
      throw new AuthError("Unauthenticated", "Token has no subject");

    const keys = await this.keysFor(provider, header.kid);
    const jwk = keys.find((key) => header.kid === undefined || key.kid === header.kid);
    if (!jwk) throw new AuthError("Unauthenticated", "No matching signing key");
    const importParams =
      algorithm === "RS256"
        ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
        : { name: "ECDSA", namedCurve: "P-256" };
    const verifyParams =
      algorithm === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, importParams, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      verifyParams,
      key,
      base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) throw new AuthError("Unauthenticated", "Invalid token signature");

    const identity: Record<string, JSONValue> = {
      tokenIdentifier: `${issuer}|${claims.sub}`,
      subject: claims.sub,
      issuer,
    };
    for (const [claim, value] of Object.entries(claims)) {
      if (REGISTERED_CLAIMS.has(claim) || value === null) continue;
      const mapped = STANDARD_CLAIMS[claim];
      if (mapped === "address" && typeof value === "object")
        identity.address = JSON.stringify(value);
      else if (mapped === "updatedAt" && typeof value === "number")
        identity.updatedAt = new Date(value * 1000).toISOString();
      else identity[mapped ?? claim] = value;
    }
    return { identity: identity as Identity, expiresAt: claims.exp * 1000 };
  }

  /** Whether a previously verified token has expired (with Convex-like clock skew). */
  expired(expiresAt: number): boolean {
    return expiresAt + CLOCK_SKEW_SECONDS * 1000 < this.now();
  }
}
