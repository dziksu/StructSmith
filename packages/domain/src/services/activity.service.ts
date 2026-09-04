import type { ActivityEntry } from "@structsmith/contracts";
import { requireWorkspace, type ServiceContext } from "../context";

export class ActivityService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string, limit = 100): ActivityEntry[] {
    requireWorkspace(this.ctx.store, workspaceId);
    return this.ctx.store.activity.listByWorkspace(workspaceId, limit);
  }
}
