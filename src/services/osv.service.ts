interface OsvPackage {
  ecosystem: string;
  name: string;
}

interface OsvQuery {
  package: OsvPackage;
  version: string;
}

export interface OsvVulnerability {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  database_specific?: {
    severity?: string;
  };
  severity?: Array<{
    type?: string;
    score?: string;
  }>;

  affected?: Array<{
    package?: OsvPackage;

    ranges?: Array<{
      events?: Array<{
        introduced?: string;
        fixed?: string;
      }>;
    }>;
  }>;

  references?: Array<{
    type?: string;
    url?: string;
  }>;
}

interface OsvResponse {
  vulns?: OsvVulnerability[];
}

const OSV_TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryOsv(
  packageName: string,
  version: string
): Promise<OsvVulnerability[]> {
  const query: OsvQuery = {
    package: {
      ecosystem: "npm",
      name: packageName
    },
    version
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        "https://api.osv.dev/v1/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(query),
          signal: AbortSignal.timeout(OSV_TIMEOUT_MS)
        }
      );

      // Handle rate limit (429) or transient server errors (503)
      if (
        (response.status === 429 || response.status === 503) &&
        attempt < MAX_RETRIES
      ) {
        await wait(RETRY_DELAY_MS);
        continue;
      }

      if (!response.ok) {
        return [];
      }

      const data =
        (await response.json()) as OsvResponse;

      if (!data || typeof data !== "object" || !Array.isArray(data.vulns)) {
        return [];
      }

      return data.vulns;
    } catch {
      if (attempt < MAX_RETRIES) {
        await wait(RETRY_DELAY_MS);
        continue;
      }
      return [];
    }
  }

  return [];
}