export type ValidateOptions = {
  /** When true, print an install hint / offer for supported platforms. Default false. */
  offerInstall?: boolean;
  /** Override homepage URL. */
  homepage?: string;
  /** If true, throw instead of process.exit. Useful for tests. */
  throwOnFailure?: boolean;
};

export type ValidateResult = {
  ok: true;
  versionHint?: string;
};

const DEFAULT_HOMEPAGE = "https://www.nushell.sh/";

/**
 * Detect whether this process is likely running under Nushell.
 * Heuristics are intentionally simple in v0; harden over time.
 */
export function isNushellHost(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NU_VERSION && env.NU_VERSION.length > 0) return true;
  // Nushell may expose other markers in future; keep a narrow allow-list.
  if (env.NU_PROMPT_COMMAND != null) return true;
  return false;
}

function installHint(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "Install with: winget install Nushell.Nushell";
    case "darwin":
      return "Install with: brew install nushell";
    default:
      return "Install from https://www.nushell.sh/book/installation.html";
  }
}

/**
 * Call near process start in Nushell-tailored CLIs.
 * Fails clearly when the host shell is not Nushell.
 */
export async function validate(
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const homepage = options.homepage ?? DEFAULT_HOMEPAGE;

  if (isNushellHost()) {
    return { ok: true, versionHint: process.env.NU_VERSION };
  }

  const lines = [
    "This tool requires Nushell (nu).",
    `Homepage: ${homepage}`,
    "It is not supported under bash, zsh, or PowerShell.",
  ];

  if (options.offerInstall) {
    lines.push(installHint(process.platform));
  }

  const message = lines.join("\n");

  if (options.throwOnFailure) {
    throw new Error(message);
  }

  console.error(message);
  process.exit(1);
}
