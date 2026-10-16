// Transitional generated-runtime boundary only; route ownership lives in Rust.
import rust from "./build/worker/shim.mjs";
import next from "../.open-next/worker.js";
export * from "../.open-next/worker.js";

class ChrondleWorker extends rust {
  async fetch(request) {
    const response = await super.fetch(request);
    return response.headers.get("X-Chrondle-Runtime") === "rust"
      ? response
      : next.fetch(request, this.env, this.ctx);
  }
}

export default ChrondleWorker;
