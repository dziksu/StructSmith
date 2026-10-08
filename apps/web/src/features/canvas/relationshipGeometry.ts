import type { AttachmentSide, ControlPoint } from "@structsmith/contracts";
import { Position } from "@xyflow/react";

export const sideForHandle = (handle: string | null | undefined): AttachmentSide | null =>
  (({ t: "top", r: "right", b: "bottom", l: "left" })[handle ?? ""] as
    | AttachmentSide
    | undefined) ?? null;

/** Arc-length placement for the M/L/Q/C paths produced by React Flow. */
export function pointOnRelationshipPath(path: string, fraction: number): ControlPoint {
  const points: ControlPoint[] = [];
  let current = { x: 0, y: 0 };
  for (const match of path.matchAll(/([MLQC])([^MLQC]*)/g)) {
    const values = (match[2]?.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    const command = match[1];
    if (command === "M" || command === "L") {
      current = { x: values[0] ?? current.x, y: values[1] ?? current.y };
      points.push(current);
    } else {
      const start = current;
      const end =
        command === "Q"
          ? { x: values[2] ?? start.x, y: values[3] ?? start.y }
          : { x: values[4] ?? start.x, y: values[5] ?? start.y };
      for (let step = 1; step <= 64; step++) {
        const t = step / 64;
        const u = 1 - t;
        current =
          command === "Q"
            ? {
                x: u * u * start.x + 2 * u * t * (values[0] ?? 0) + t * t * end.x,
                y: u * u * start.y + 2 * u * t * (values[1] ?? 0) + t * t * end.y,
              }
            : {
                x:
                  u ** 3 * start.x +
                  3 * u * u * t * (values[0] ?? 0) +
                  3 * u * t * t * (values[2] ?? 0) +
                  t ** 3 * end.x,
                y:
                  u ** 3 * start.y +
                  3 * u * u * t * (values[1] ?? 0) +
                  3 * u * t * t * (values[3] ?? 0) +
                  t ** 3 * end.y,
              };
        points.push(current);
      }
    }
  }
  const lengths = points.map((point, index) => {
    const previous = points[index - 1] ?? point;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  let remaining =
    lengths.reduce((sum, length) => sum + length, 0) * Math.min(1, Math.max(0, fraction));
  for (let index = 1; index < points.length; index++) {
    const length = lengths[index] ?? 0;
    const point = points[index];
    const previous = points[index - 1];
    if (!point || !previous) continue;
    if (remaining <= length && length > 0) {
      const ratio = remaining / length;
      return {
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
      };
    }
    remaining -= length;
  }
  return points.at(-1) ?? current;
}

/** Manual bends retain a short outward segment at each attachment. */
export function pathThroughControlPoints(
  source: ControlPoint,
  target: ControlPoint,
  sourceSide: Position,
  targetSide: Position,
  controlPoints: readonly ControlPoint[],
  orthogonal: boolean,
): string {
  const outward = (point: ControlPoint, side: Position): ControlPoint => ({
    x: point.x + (side === Position.Left ? -24 : side === Position.Right ? 24 : 0),
    y: point.y + (side === Position.Top ? -24 : side === Position.Bottom ? 24 : 0),
  });
  const points = [
    source,
    outward(source, sourceSide),
    ...controlPoints,
    outward(target, targetSide),
    target,
  ];
  const segments = [`M${source.x},${source.y}`];
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    const previous = points[index - 1];
    if (!point || !previous) continue;
    if (orthogonal && previous.x !== point.x && previous.y !== point.y) {
      // Approach the target stub from the perpendicular axis.
      const vertical =
        index === points.length - 2
          ? targetSide === Position.Left || targetSide === Position.Right
          : sourceSide === Position.Top || sourceSide === Position.Bottom;
      segments.push(vertical ? `L${previous.x},${point.y}` : `L${point.x},${previous.y}`);
    }
    segments.push(`L${point.x},${point.y}`);
  }
  return segments.join(" ");
}
