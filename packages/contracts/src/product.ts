/**
 * Single place holding the product identity. Renaming the product must not
 * require touching dozens of files (see spec §79).
 */
import { version } from "../../../package.json";

export const PRODUCT = {
  name: "StructSmith",
  slug: "structsmith",
  version,
} as const;
