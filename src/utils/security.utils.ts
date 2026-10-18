import type { OsvVulnerability } from "../services/osv.service.js";

export function getCvssScore(
  vulnerability: OsvVulnerability
): number | undefined {
  const cvss = vulnerability.severity?.find(
    (item) => item.type === "CVSS_V3" || item.type === "CVSS_V4"
  );

  if (!cvss?.score) {
    return undefined;
  }

  const directScore = Number(cvss.score);
  if (!Number.isNaN(directScore) && directScore >= 0 && directScore <= 10) {
    return directScore;
  }

  const match = cvss.score.match(
    /CVSS:(?:3\.\d|4\.0)\/.*?\/(\d+(?:\.\d+)?)$/
  );

  if (!match) {
    return undefined;
  }

  const score = Number(match[1]);

  return Number.isNaN(score)
    ? undefined
    : score;
}

export function getCve(
  vulnerability: OsvVulnerability
): string | undefined {
  return vulnerability.aliases?.find(
    (alias) => alias.startsWith("CVE-")
  );
}

export function getFixedVersion(
  vulnerability: OsvVulnerability
): string | undefined {
  for (const affected of vulnerability.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {
          return event.fixed;
        }
      }
    }
  }

  return undefined;
}

export function getSecuritySeverity(
  score?: number,
  databaseSeverity?: string
): "info" | "warning" | "error" {
  if (score !== undefined) {
    if (score >= 7) {
      return "error";
    }

    if (score >= 4) {
      return "warning";
    }

    return "info";
  }

  if (databaseSeverity) {
    const normalized = databaseSeverity.toUpperCase();
    if (normalized === "CRITICAL" || normalized === "HIGH") {
      return "error";
    }
    if (normalized === "MODERATE" || normalized === "MEDIUM") {
      return "warning";
    }
    if (normalized === "LOW") {
      return "info";
    }
  }

  return "warning";
}