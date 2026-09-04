import { createAppContext } from "../apps/server/src/bootstrap";
import { loadConfig } from "../apps/server/src/config";
import { seedExampleWorkspace } from "../apps/server/src/seed";

const ctx = createAppContext({ ...loadConfig(), seedExample: false });
const id = seedExampleWorkspace(ctx.services);
console.log(`[seed] example workspace ready: ${id}`);
ctx.database.close();
