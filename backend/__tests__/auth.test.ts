import { describe, expect, it } from "vitest";
import { AuthError } from "../src/engine/auth";
import { syntheticIssuer } from "./support";

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error instanceof AuthError ? `${error.code}: ${error.message}` : String(error)),
  );

describe("JWT verification (convex/auth.config.ts providers)", () => {
  it("verifies a Clerk-style OIDC token and maps claims to Convex's UserIdentity", async () => {
    const issuer = await syntheticIssuer("https://clerk.example.test", "oidc");
    const verifier = issuer.verifier();
    const token = await issuer.sign({
      sub: "user_123",
      email: "ada@example.test",
      email_verified: true,
      given_name: "Ada",
      picture: "https://img.example.test/ada.png",
      public_metadata: { role: "admin" },
    });
    const { identity, expiresAt } = await verifier.verify(token);
    expect(identity).toEqual({
      tokenIdentifier: "https://clerk.example.test|user_123",
      subject: "user_123",
      issuer: "https://clerk.example.test",
      email: "ada@example.test",
      emailVerified: true,
      givenName: "Ada",
      pictureUrl: "https://img.example.test/ada.png",
      public_metadata: { role: "admin" },
    });
    expect(expiresAt).toBeGreaterThan(Date.now());

    await verifier.verify(await issuer.sign({ sub: "user_456" }));
    expect(issuer.requests).toEqual(["https://clerk.example.test/.well-known/openid-configuration", "https://clerk.example.test/.well-known/jwks.json"]);
  });

  it("rejects tokens Convex would reject", async () => {
    const issuer = await syntheticIssuer();
    const verifier = issuer.verifier();
    const stranger = await syntheticIssuer("https://stranger.example.test");
    const otherKey = await syntheticIssuer();
    const past = Math.floor(Date.now() / 1000) - 3600;

    expect(await failure(verifier.verify("not.a.jwt"))).toMatch(/^InvalidAuthHeader: /);
    expect(await failure(verifier.verify("abc"))).toMatch(/^InvalidAuthHeader: /);
    expect(await failure(verifier.verify(await stranger.sign({ sub: "u" })))).toMatch(/^NoAuthProvider: /);
    expect(await failure(verifier.verify(await issuer.sign({ sub: "u", aud: "someone-else" })))).toMatch(/audience/);
    expect(await failure(verifier.verify(await issuer.sign({ sub: "u", exp: past })))).toMatch(/expired/);
    expect(await failure(verifier.verify(await issuer.sign({ sub: "u", nbf: past + 7200 + 3600 })))).toMatch(/not yet valid/);
    expect(await failure(verifier.verify(await issuer.sign({ sub: "" })))).toMatch(/subject/);
    expect(await failure(verifier.verify(await otherKey.sign({ sub: "u", iss: issuer.issuer })))).toMatch(/signature/);
    expect(await failure(verifier.verify(await issuer.sign({ sub: "u" }, { header: { alg: "none", kid: "synthetic-1" } })))).toMatch(/algorithm/);
  });
});
