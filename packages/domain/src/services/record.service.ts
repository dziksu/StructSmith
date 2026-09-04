import type {
  ArchitectureRecord,
  CreateRecordInput,
  UpdateRecordInput,
} from "@structsmith/contracts";
import { mutate, type MutationOptions, type ServiceContext } from "../context";
import * as engine from "../engine";

export class RecordService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): ArchitectureRecord[] {
    return this.ctx.store.records.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, input: CreateRecordInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const record = engine.createRecord(repos, workspace, input);
      return {
        result: record,
        message: `Added ${record.kind}: ${record.title}`,
        kind: "record" as const,
      };
    });
  }

  update(workspaceId: string, recordId: string, input: UpdateRecordInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const record = engine.updateRecord(repos, workspace, recordId, input);
      return { result: record, message: `Updated record: ${record.title}`, kind: "record" as const };
    });
  }

  delete(workspaceId: string, recordId: string, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const title = repos.records.findById(recordId)?.title ?? recordId;
      engine.deleteRecord(repos, workspace, recordId);
      return { result: { id: recordId }, message: `Deleted record: ${title}`, kind: "record" as const };
    });
  }
}
