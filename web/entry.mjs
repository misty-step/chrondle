// Transitional generated-runtime boundary only; route ownership lives in Rust.
import rust from "./build/worker/shim.mjs";
import next from "../.open-next/worker.js";
export * from "../.open-next/worker.js";

const worker = {
  ...next,
  async fetch(request, env, ctx) {
    const response = await rust.fetch(request, env, ctx);
    return response.headers.get("X-Chrondle-Runtime") === "rust"
      ? response
      : next.fetch(request, env, ctx);
  },
};

export default worker;
