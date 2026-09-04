/** Only stable semantic versions are published by the main release branch. */
export const isReleaseVersion = (value: string): boolean =>
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

export function versionFromTags(tags: string): string {
  const versions = tags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("v"))
    .map((tag) => tag.slice(1))
    .filter(isReleaseVersion);
  if (versions.length > 1) throw new Error("Multiple release tags point at this commit.");
  return versions[0] ?? "";
}
