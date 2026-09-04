import { type DomainConfig, defaultDomainConfig, type ServiceContext } from "../context";
import type { EventBus, Store } from "../ports";
import { ActivityService } from "./activity.service";
import { ElementService } from "./element.service";
import { ImportService } from "./import.service";
import { ModelService } from "./model.service";
import { RecordService } from "./record.service";
import { RelationshipService } from "./relationship.service";
import { SnapshotService } from "./snapshot.service";
import { ViewService } from "./view.service";
import { WorkspaceService } from "./workspace.service";

export interface Services {
  context: ServiceContext;
  workspaces: WorkspaceService;
  elements: ElementService;
  relationships: RelationshipService;
  views: ViewService;
  records: RecordService;
  model: ModelService;
  snapshots: SnapshotService;
  activity: ActivityService;
  imports: ImportService;
}

export function createServices(
  store: Store,
  bus: EventBus,
  config: Partial<DomainConfig> = {},
): Services {
  const context: ServiceContext = {
    store,
    bus,
    config: { ...defaultDomainConfig, ...config },
  };

  return {
    context,
    workspaces: new WorkspaceService(context),
    elements: new ElementService(context),
    relationships: new RelationshipService(context),
    views: new ViewService(context),
    records: new RecordService(context),
    model: new ModelService(context),
    snapshots: new SnapshotService(context),
    activity: new ActivityService(context),
    imports: new ImportService(context),
  };
}

export {
  ActivityService,
  ElementService,
  ImportService,
  ModelService,
  RecordService,
  RelationshipService,
  SnapshotService,
  ViewService,
  WorkspaceService,
};
