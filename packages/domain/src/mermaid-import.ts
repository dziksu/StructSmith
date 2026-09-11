import type {
  ArchitectureElement,
  ArchitectureRelationship,
  ElementKind,
  ElementRole,
  WorkspaceDocument,
} from "@structsmith/contracts";
import {
  elementKinds,
  elementRoles,
  ViewSettingsSchema,
  WorkspaceDocumentSchema,
} from "@structsmith/contracts";
import { createId, nowIso } from "./ids";
import { computeLayout, DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "./layout";

export interface MermaidImportOptions {
  workspaceName?: string;
  workspaceId?: string;
}

const MAX_NODES = 2_000;
const MAX_EDGES = 10_000;
const shapes = [
  ["(((", ")))"],
  ["[[", "]]"],
  ["((", "))"],
  ["([", "])"],
  ["[(", ")]"],
  ["{{", "}}"],
  ["[/", "/]"],
  ["[/", "\\]"],
  ["[\\", "\\]"],
  ["[\\", "/]"],
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  [">", "]"],
] as const;
const fullConnector = /^(?:[<ox])?(?:-{2,}|={2,}|-\.+-|~{3,})(?:[>ox])?/;
const kindByName = new Map(elementKinds.map((kind) => [kind.toLowerCase(), kind]));
const roleByName = new Map(elementRoles.map((role) => [role.toLowerCase(), role]));

function unquote(value: string): string {
  const text = value.trim();
  return (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
    ? text.slice(1, -1)
    : text;
}

function labelText(value: string): string {
  let text = unquote(value);
  if (text.startsWith("`") && text.endsWith("`")) text = text.slice(1, -1);
  const entities: Record<string, string> = {
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    amp: "&",
    nbsp: " ",
  };
  return text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:b|i|em|strong|small|span)(?:\s[^>]*)?>/gi, "")
    .replace(
      /&(?:#(x[\da-f]+|\d+)|([a-z]+));|#(\d+|[a-z]+);/gi,
      (
        original,
        numeric: string | undefined,
        named: string | undefined,
        mermaid: string | undefined,
      ) => {
        const token = numeric ?? mermaid ?? named ?? "";
        if (Object.hasOwn(entities, token)) return entities[token] ?? original;
        if (!/^(?:\d+|x[\da-f]+)$/i.test(token)) return original;
        const code = token.startsWith("x") ? Number.parseInt(token.slice(1), 16) : Number(token);
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : original;
      },
    )
    .replace(/[\t ]+/g, " ")
    .trim();
}

/** Split statements without splitting quoted labels, shape bodies or Mermaid entities. */
function statements(source: string): string[] {
  const result: string[] = [];
  let buffer = "";
  let depth = 0;
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (quote) {
      buffer += char;
      if (char === "\\" && source[index + 1] === quote) {
        buffer += source[++index];
      } else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || (char === "'" && /[:[,]\s*$/.test(buffer))) {
      quote = char;
    } else if (source.startsWith("%%{", index)) {
      const end = source.indexOf("}%%", index + 3);
      if (end < 0) throw new Error("Unclosed Mermaid configuration directive.");
      index = end + 2;
      continue;
    } else if (source.startsWith("%%", index)) {
      const end = source.indexOf("\n", index);
      index = end < 0 ? source.length : end - 1;
      continue;
    } else if ("[({".includes(char)) {
      depth += 1;
    } else if ("])}".includes(char)) {
      depth = Math.max(0, depth - 1);
    } else if ((char === "\n" || char === ";") && depth === 0) {
      if (char === ";" && /(?:&(?:#x?)?|#)[a-z\d]+$/i.test(buffer)) {
        buffer += char;
        continue;
      }
      if (buffer.trim()) result.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (quote || depth) throw new Error("Unclosed label, shape or metadata block.");
  if (buffer.trim()) result.push(buffer.trim());
  return result;
}

class Cursor {
  index = 0;
  constructor(readonly source: string) {}
  space(): void {
    while (/\s/.test(this.source[this.index] ?? "")) this.index += 1;
  }
  rest(): string {
    return this.source.slice(this.index);
  }
  id(): string {
    this.space();
    const start = this.index;
    while (this.index < this.source.length) {
      const tail = this.rest();
      if (/^(?:--|==|-\.|:::)/.test(tail) || !/[\p{L}\p{N}_:.-]/u.test(tail[0] ?? "")) break;
      this.index += 1;
    }
    if (start === this.index)
      throw new Error(`Expected a node id near "${this.rest().slice(0, 60)}".`);
    return this.source.slice(start, this.index);
  }
  /** Find a closing delimiter, respecting quotes inside it. */
  body(open: string, close: string): string {
    this.index += open.length;
    const start = this.index;
    let quote = "";
    for (; this.index < this.source.length; this.index += 1) {
      const char = this.source[this.index];
      if (quote) {
        if (char === "\\" && this.source[this.index + 1] === quote) this.index += 1;
        else if (char === quote) quote = "";
      } else if (this.source.startsWith(close, this.index)) {
        const value = this.source.slice(start, this.index);
        this.index += close.length;
        return value;
      } else if (
        char === '"' ||
        (char === "'" && /[:[,]\s*$/.test(this.source.slice(start, this.index)))
      ) {
        quote = char;
      }
    }
    throw new Error(`Missing closing ${close}.`);
  }
  shape(): string | undefined {
    this.space();
    for (const [open, close] of shapes) {
      if (!this.rest().startsWith(open)) continue;
      // Both sloping shapes share an opener; choose the closing slope actually present.
      if ((open === "[/" || open === "[\\") && !this.rest().includes(close)) continue;
      return this.body(open, close);
    }
    return undefined;
  }
  attributes(): Map<string, string> | undefined {
    this.space();
    if (!this.rest().startsWith("@{")) return undefined;
    const body = this.body("@{", "}");
    const values = new Map<string, string>();
    const cursor = new Cursor(body);
    while (cursor.index < body.length) {
      cursor.space();
      const match = cursor.rest().match(/^([\w-]+)\s*:\s*/);
      if (!match?.[1]) throw new Error("Malformed Mermaid node or edge attributes.");
      cursor.index += match[0].length;
      const quote = cursor.source[cursor.index];
      let value: string;
      if (quote === '"' || quote === "'") {
        value = cursor.body(quote, quote);
      } else {
        const start = cursor.index;
        while (cursor.index < body.length && body[cursor.index] !== ",") cursor.index += 1;
        value = body.slice(start, cursor.index).trim();
      }
      values.set(match[1], value);
      cursor.space();
      if (cursor.index < body.length && body[cursor.index++] !== ",") {
        throw new Error("Expected a comma between Mermaid attributes.");
      }
    }
    return values;
  }
}

function applyLabel(node: ArchitectureElement, raw: string): void {
  const lines = labelText(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  node.name = lines.shift() || node.properties["mermaid.id"] || "Node";
  const description: string[] = [];
  for (const line of lines) {
    const tokens = line.split(/[\u00b7|]/).map((token) => token.trim().toLowerCase());
    if (tokens.every((token) => kindByName.has(token) || roleByName.has(token))) {
      for (const [index, token] of tokens.entries()) {
        const kind = index === 0 ? kindByName.get(token) : undefined;
        if (kind) node.kind = kind;
        else node.role = roleByName.get(token) ?? node.role;
      }
    } else if (/^\[.*\]$/.test(line)) {
      node.technology = line.slice(1, -1);
    } else description.push(line);
  }
  node.description = description.join("\n") || null;
  if (node.name.length > 200) throw new Error("Node names must be at most 200 characters.");
}

/** Pure import adapter: Mermaid syntax -> semantic document -> view-only layout. */
export function parseMermaidToWorkspaceDocument(
  mermaid: string,
  options: MermaidImportOptions = {},
): WorkspaceDocument {
  if (mermaid.length > 1_000_000) throw new Error("Mermaid source exceeds 1,000,000 characters.");
  let source = mermaid
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (/^```mermaid\s*\n/i.test(source)) {
    const match = source.match(/^```mermaid[^\n]*\n([\s\S]*?)\n```\s*$/i);
    if (!match?.[1] || match[1].includes("```"))
      throw new Error("Provide exactly one Mermaid code block.");
    source = match[1].trim();
  }
  let title = "Imported Mermaid Diagram";
  if (source.startsWith("---\n")) {
    const end = source.indexOf("\n---", 4);
    if (end < 0) throw new Error("Unclosed YAML frontmatter.");
    const frontmatter = source.slice(4, end);
    const scalar = frontmatter.match(/^title:\s*(.+)$/m)?.[1];
    if (scalar) {
      if (/^[>|]/.test(scalar)) throw new Error("Use a single-line title in Mermaid frontmatter.");
      title = labelText(scalar);
    }
    source = source.slice(end + 4).trim();
  }
  const lines = statements(source);
  const header = lines.shift()?.match(/^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\s*$/i);
  if (!header?.[1])
    throw new Error(
      "Only Mermaid flowchart/graph diagrams with a direction (e.g. flowchart LR) are supported.",
    );
  const originalDirection = header[1].toUpperCase();
  const direction = originalDirection === "LR" || originalDirection === "RL" ? "LR" : "TB";
  const workspaceId = options.workspaceId ?? createId("mermaid");
  const viewId = createId("mermaid-view");
  const timestamp = nowIso();
  const nodes = new Map<string, ArchitectureElement>();
  const edges: ArchitectureRelationship[] = [];
  const edgeNames = new Set<string>();
  const groups = new Set<string>();
  const parents: string[] = [];

  const nodeFor = (rawId: string): ArchitectureElement => {
    let node = nodes.get(rawId);
    if (!node) {
      if (nodes.size >= MAX_NODES)
        throw new Error(`Mermaid import supports at most ${MAX_NODES} nodes.`);
      node = {
        id: createId(rawId),
        workspaceId,
        parentId: null,
        kind: "custom",
        role: null,
        name: rawId,
        description: null,
        technology: null,
        external: false,
        tags: [],
        properties: { "mermaid.id": rawId },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      nodes.set(rawId, node);
    }
    const parent = parents.at(-1);
    if (parent && !node.parentId) node.parentId = nodes.get(parent)?.id ?? null;
    return node;
  };

  const endpoints = (cursor: Cursor): ArchitectureElement[] => {
    const result: ArchitectureElement[] = [];
    for (;;) {
      const node = nodeFor(cursor.id());
      const label = cursor.shape();
      if (label !== undefined) applyLabel(node, label);
      const attrs = cursor.attributes();
      if (attrs?.has("label")) applyLabel(node, attrs.get("label") ?? "");
      // Explicit semantic metadata is accepted; arbitrary geometry does not imply C4 kinds.
      const kind = attrs?.get("kind")?.toLowerCase();
      const role = attrs?.get("role")?.toLowerCase();
      if (kind && kindByName.has(kind)) node.kind = kindByName.get(kind) as ElementKind;
      if (role && roleByName.has(role)) node.role = roleByName.get(role) as ElementRole;
      cursor.space();
      if (cursor.rest().startsWith(":::")) {
        cursor.index += 3;
        cursor.id();
      }
      result.push(node);
      cursor.space();
      if (!cursor.rest().startsWith("&")) break;
      cursor.index += 1;
    }
    return result;
  };

  const addEdge = (
    from: ArchitectureElement,
    to: ArchitectureElement,
    connector: string,
    label: string,
    edgeName?: string,
  ): void => {
    if (edges.length >= MAX_EDGES)
      throw new Error(`Mermaid import supports at most ${MAX_EDGES} relationships.`);
    const text = labelText(label);
    const technology = text.match(/\s*\[([^\]]+)\]\s*$/);
    edges.push({
      id: createId("mermaid-edge"),
      workspaceId,
      sourceElementId: from.id,
      targetElementId: to.id,
      description: (technology ? text.slice(0, technology.index).trim() : text) || null,
      technology: technology?.[1] ?? null,
      interactionStyle: connector.includes(".")
        ? "async"
        : /[<>]/.test(connector)
          ? "sync"
          : "custom",
      tags: [],
      properties: edgeName ? { "mermaid.id": edgeName } : {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };

  for (const [index, line] of lines.entries()) {
    try {
      if (/^(?:classDef|class|style|linkStyle|click|accTitle|accDescr)\b/.test(line)) continue;
      if (/^direction\s+(?:TB|TD|BT|LR|RL)$/.test(line) && parents.length) continue;
      if (line === "end") {
        if (!parents.pop()) throw new Error("Unexpected subgraph end.");
        continue;
      }
      if (/^subgraph\s+/.test(line)) {
        const rest = line.replace(/^subgraph\s+/, "");
        const cursor = new Cursor(rest);
        let rawId: string;
        let label: string | undefined;
        if (rest.startsWith('"') || !rest.includes("[")) {
          rawId = labelText(rest);
          label = rawId;
        } else {
          rawId = cursor.id();
          label = cursor.shape();
          cursor.space();
          if (cursor.rest()) throw new Error("Malformed subgraph declaration.");
        }
        if (!rawId || groups.has(rawId)) throw new Error("Empty or duplicate subgraph id.");
        const node = nodeFor(rawId);
        if (label !== undefined) applyLabel(node, label);
        groups.add(rawId);
        parents.push(rawId);
        continue;
      }
      const cursor = new Cursor(line);
      const attributeId = line.match(/^([\p{L}\p{N}_:.-]+)\s*@\{/u)?.[1];
      if (attributeId && edgeNames.has(attributeId)) {
        cursor.id();
        cursor.attributes();
        cursor.space();
        if (cursor.rest()) throw new Error("Unexpected text after edge attributes.");
        continue;
      }
      let from = endpoints(cursor);
      while (cursor.rest()) {
        let edgeName: string | undefined;
        const edgeId = cursor.rest().match(/^([\p{L}\p{N}_:.-]+)@(?=[<ox=~.-])/u);
        if (edgeId?.[1]) {
          edgeName = edgeId[1];
          edgeNames.add(edgeName);
          cursor.index += edgeId[0].length;
        }
        let connector = cursor.rest().match(fullConnector)?.[0];
        let label = "";
        // Inline text links have a separate opening and closing connector.
        const prefix = cursor.rest().match(/^(?:[<ox])?(?:--|==|-\.)\s+/)?.[0];
        if (prefix && (!connector || connector === prefix.trim())) {
          cursor.index += prefix.length;
          const start = cursor.index;
          let quote = "";
          const ending = prefix.includes("=")
            ? /^={2,}[>ox]?/
            : prefix.includes(".")
              ? /^\.+-[>ox]?/
              : /^-{2,}[>ox]?/;
          while (cursor.index < line.length) {
            const char = line[cursor.index];
            if (char === '"') quote = quote ? "" : '"';
            const end = !quote ? cursor.rest().match(ending)?.[0] : undefined;
            if (end) {
              label = line.slice(start, cursor.index).trim();
              connector = prefix.trim() + end;
              cursor.index += end.length;
              break;
            }
            cursor.index += 1;
          }
          if (!label) throw new Error("Missing inline edge label or closing connector.");
        } else {
          if (!connector)
            throw new Error(`Unsupported syntax near "${cursor.rest().slice(0, 60)}".`);
          cursor.index += connector.length;
        }
        cursor.space();
        if (cursor.rest().startsWith("|")) label = cursor.body("|", "|");
        const to = endpoints(cursor);
        if (!connector) throw new Error("Missing edge connector.");
        if (!connector.includes("~")) {
          const reverse = /^[<ox]/.test(connector);
          const forward = /[>ox]$/.test(connector) || !reverse;
          for (const sourceNode of from)
            for (const targetNode of to) {
              if (forward) addEdge(sourceNode, targetNode, connector, label, edgeName);
              if (reverse) addEdge(targetNode, sourceNode, connector, label, edgeName);
            }
        }
        from = to;
      }
    } catch (error) {
      throw new Error(
        `Statement ${index + 2}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (parents.length) throw new Error("Unclosed subgraph: missing end.");
  if (!nodes.size) throw new Error("The Mermaid diagram has no importable elements.");
  const elements = [...nodes.values()];
  const byId = new Map(elements.map((node) => [node.id, node]));
  for (const node of elements) {
    const seen = new Set<string>([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (seen.has(parent)) throw new Error("Subgraph membership creates a containment cycle.");
      seen.add(parent);
      parent = byId.get(parent)?.parentId ?? null;
    }
  }
  const settings = ViewSettingsSchema.parse({ autoLayoutDirection: direction });
  const positions = computeLayout(
    elements.map((node) => ({ id: node.id, parentId: node.parentId })),
    edges.map((edge) => ({
      source: edge.sourceElementId,
      target: edge.targetElementId,
      label: edge.description ?? undefined,
    })),
    direction,
  );
  const placements = new Map(positions.map((position) => [position.id, position]));
  const maxX = Math.max(0, ...positions.map((position) => position.x));
  const maxY = Math.max(0, ...positions.map((position) => position.y));
  return WorkspaceDocumentSchema.parse({
    formatVersion: 1,
    workspace: {
      id: workspaceId,
      name: options.workspaceName?.trim() || title,
      description: null,
      mode: "relaxed",
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    elements,
    relationships: edges,
    boundaries: [],
    records: [],
    views: [
      {
        id: viewId,
        workspaceId,
        key: "mermaid",
        name: "Imported Mermaid",
        description: null,
        kind: "custom",
        scopeElementId: null,
        settings,
        boundaries: [],
        elements: elements.map((node, zIndex) => {
          const position = placements.get(node.id);
          const x = position?.x ?? 0;
          const y = position?.y ?? 0;
          return {
            viewId,
            elementId: node.id,
            x: originalDirection === "RL" ? maxX - x : x,
            y: originalDirection === "BT" ? maxY - y : y,
            width: DEFAULT_NODE_WIDTH,
            height: DEFAULT_NODE_HEIGHT,
            hidden: false,
            locked: false,
            zIndex,
          };
        }),
        relationships: edges.map((edge) => ({
          viewId,
          relationshipId: edge.id,
          hidden: false,
          labelPosition: null,
          controlPoints: [],
        })),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  });
}
