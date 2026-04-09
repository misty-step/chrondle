// @ts-nocheck

import { api as generatedApi } from "../../convex/_generated/api";

/**
 * Isolates Convex generated API type expansion from callsites that only need
 * opaque function references at runtime.
 */
export const anyPublicApi = generatedApi as any;
