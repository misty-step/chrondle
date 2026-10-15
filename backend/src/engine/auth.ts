/**
 * Verifies client JWTs the way Convex does for `convex/auth.config.ts`:
 * OIDC providers ({ domain, applicationID }) via discovery + JWKS, and
 * `customJwt` providers ({ issuer, jwks, algorithm, applicationID? }).
 * The resulting identity mirrors Convex's `UserIdentity`, including custom
 * claims such as Clerk's `public_metadata`.
 */
import type { JSONValue } from "convex/values";
import type { Identity } from "./engine";

export type AuthProvider =
  | { domain: string; applicationID: string; type?: undefined }
  | { type: "customJwt"; issuer: string; jwks: string; algorithm: "RS256" | "ES256"; applicationID?: string };

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
const CLOCK_SKEW_SECONDS = 5;

function base64UrlDecode(segment: string): Uint8Array<ArrayBuffer> {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type VerifiedToken = { identity: Identity; expiresAt: number };

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export class AuthVerifier {
  private keys = new Map<string, { fetchedAt: number; keys: Jwk[] }>();

  constructor(
    private readonly providers: AuthProvider[],
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {}

  private async jwksUrl(provider: AuthProvider): Promise<string> {
    if (provider.type === "customJwt") return provider.jwks;
    const response = await this.fetchFn(`${trimSlash(provider.domain)}/.well-known/openid-configuration`);
    if (!response.ok) throw new AuthError("Unauthenticated", `OIDC discovery failed for ${provider.domain}: ${response.status}`);
    const config = (await response.json()) as { jwks_uri?: string };
    if (!config.jwks_uri) throw new AuthError("Unauthenticated", `OIDC discovery for ${provider.domain} has no jwks_uri`);
    return config.jwks_uri;
  }

  private async keysFor(provider: AuthProvider, kid: string | undefined): Promise<Jwk[]> {
    const cacheKey = provider.type === "customJwt" ? provider.jwks : provider.domain;
    const cached = this.keys.get(cacheKey);
    const fresh = cached && this.now() - cached.fetchedAt < KEY_TTL_MS;
    const hasKid = cached?.keys.some((key) => kid === undefined || key.kid === kid);
    if (cached && fresh && hasKid) return cached.keys;
    const response = await this.fetchFn(await this.jwksUrl(provider));
    if (!response.ok) throw new AuthError("Unauthenticated", `Could not fetch JWKS for ${cacheKey}: ${response.status}`);
    const { keys } = (await response.json()) as { keys: Jwk[] };
    this.keys.set(cacheKey, { fetchedAt: this.now(), keys });
    return keys;
  }

  async verify(token: string): Promise<VerifiedToken> {
    const parts = token.split(".");
    const unparseable = "Could not parse JWT payload. Check that the token is a valid JWT format with three base64-encoded parts separated by dots.";
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
      candidate.type === "customJwt" ? candidate.issuer === issuer : trimSlash(candidate.domain) === trimSlash(issuer),
    );
    if (!provider) throw new AuthError("NoAuthProvider", `No auth provider found matching the given token (issuer ${issuer || "missing"})`);

    const applicationID = provider.applicationID;
    if (applicationID !== undefined) {
      const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audience.includes(applicationID)) throw new AuthError("Unauthenticated", "Token audience does not match the provider applicationID");
    }
    const algorithm = provider.type === "customJwt" ? provider.algorithm : "RS256";
    if (header.alg !== algorithm) throw new AuthError("Unauthenticated", `Unsupported JWT algorithm ${header.alg}`);

    const nowSeconds = this.now() / 1000;
    if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) throw new AuthError("Unauthenticated", "Token expired");
    if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > nowSeconds) throw new AuthError("Unauthenticated", "Token not yet valid");
    if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new AuthError("Unauthenticated", "Token has no subject");

    const keys = await this.keysFor(provider, header.kid);
    const jwk = keys.find((key) => header.kid === undefined || key.kid === header.kid);
    if (!jwk) throw new AuthError("Unauthenticated", "No matching signing key");
    const importParams =
      algorithm === "RS256" ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } : { name: "ECDSA", namedCurve: "P-256" };
    const verifyParams = algorithm === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: "SHA-256" };
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
      if (mapped === "address" && typeof value === "object") identity.address = JSON.stringify(value);
      else if (mapped === "updatedAt" && typeof value === "number") identity.updatedAt = new Date(value * 1000).toISOString();
      else identity[mapped ?? claim] = value;
    }
    return { identity: identity as Identity, expiresAt: claims.exp * 1000 };
  }

  /** Whether a previously verified token has expired (with Convex-like clock skew). */
  expired(expiresAt: number): boolean {
    return expiresAt + CLOCK_SKEW_SECONDS * 1000 < this.now();
  }
}
