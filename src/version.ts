import packageJson from "../package.json" with {
  type: "json"
};

/*
 * Single source of truth for the CLI version: package.json.
 * Used by `lumen --version` and the JSON output, so they can't drift apart.
 */
export const VERSION: string = packageJson.version;
