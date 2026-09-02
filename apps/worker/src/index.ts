import { createWorkerApp } from "./app";
import type { WorkerEnv } from "./types/env";

const app = createWorkerApp();

export default {
  fetch(request, env) {
    return app.fetch(request, env);
  },
} satisfies ExportedHandler<WorkerEnv>;
