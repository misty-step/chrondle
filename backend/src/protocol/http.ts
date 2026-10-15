/**
 * Convex HTTP API used by `ConvexHttpClient` / `fetchQuery` / `preloadQuery`:
 * POST /api/query | /api/mutation | /api/action with
 * `{ path, format: "convex_encoded_json", args: [args] }`.
 *
 * Shapes mirror Convex production (recorded in the migration evidence):
 * results and function errors are HTTP 200 `{ status, value | errorMessage,
 * errorData? }` without log lines; bad tokens are 401 `{ code, message }`;
 * CORS reflects the caller's origin.
 */
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { AuthError, type AuthVerifier } from "../engine/auth";
import type { Engine, Identity } from "../engine/engine";

const ALLOWED_METHODS = "GET,POST,OPTIONS,PATCH,DELETE,PUT";

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "origin, access-control-request-method, access-control-request-headers",
  };
}

export function preflight(request: Request): Response {
  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ?? "",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

export async function handleHttpApi(
  request: Request,
  kind: "query" | "mutation" | "action",
  engine: Engine,
  verifier: AuthVerifier,
): Promise<Response> {
  if (request.method !== "POST")
    return json(request, { code: "MethodNotAllowed", message: "Use POST" }, 405);
  let body: { path?: string; args?: JSONValue[]; format?: string };
  try {
    body = await request.json();
  } catch {
    return json(request, { code: "BadJsonBody", message: "Request body is not valid JSON" }, 400);
  }
  if (typeof body.path !== "string")
    return json(request, { code: "BadRequest", message: "Missing function path" }, 400);

  let identity: Identity | null = null;
  const authorization = request.headers.get("Authorization");
  if (authorization) {
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    try {
      identity = (await verifier.verify(token)).identity;
    } catch (error) {
      const failure =
        error instanceof AuthError
          ? error
          : new AuthError("Unauthenticated", "Could not verify token");
      return json(request, { code: failure.code, message: failure.message }, 401);
    }
  }

  try {
    const args = jsonToConvex(body.args?.[0] ?? {}) as Record<string, Value>;
    const value =
      kind === "query"
        ? await engine.runQuery(body.path, args, identity)
        : kind === "mutation"
          ? (await engine.runMutation(body.path, args, identity)).value
          : await engine.runAction(body.path, args, identity);
    return json(request, { status: "success", value: convexToJson(value) });
  } catch (error) {
    const failure = engine.clientError(error);
    return json(request, {
      status: "error",
      errorMessage: failure.errorMessage,
      errorData: failure.errorData,
    });
  }
}
