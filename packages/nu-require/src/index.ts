import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";

export type ValidateOptions = {
  /**
   * When Nushell is on PATH but this process is not under `nu`, re-exec the
   * same argv inside Nushell. Default true.
   */
  relaunch?: boolean;
  /** When true (and relaunch is impossible), print an install hint. Default false. */
  offerInstall?: boolean;
  /** Override homepage URL. */
  homepage?: string;
  /** If true, throw instead of process.exit. Useful for tests. */
  throwOnFailure?: boolean;
  /**
   * Full argv to re-exec under `nu` (including program path).
   * Defaults to `[process.execPath, ...process.argv.slice(1)]`.
   */
  argv?: string[];
};

export type ValidateResult = {
  ok: true;
  versionHint?: string;
  /** True when this process was already under Nushell (no relaunch). */
  relaunched?: false;
};

const DEFAULT_HOMEPAGE = "https://www.nushell.sh/";
const RELAUNCH_ENV = "NU_REQUIRE_RELAUNCHED";

/**
 * Detect whether this process is likely running under Nushell.
 * Heuristics are intentionally simple in v0; harden over time.
 */
export function isNushellHost(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NU_VERSION && env.NU_VERSION.length > 0) return true;
  if (env.NU_PROMPT_COMMAND != null) return true;
  return false;
}

/** Locate a `nu` binary on PATH, if any. */
export function findNushellBinary(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const pathEnv = env.PATH ?? env.Path ?? "";
  const names =
    process.platform === "win32" ? ["nu.exe", "nu.cmd", "nu"] : ["nu"];

  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      try {
        accessSync(candidate, constants.F_OK);
        return candidate;
      } catch {
        /* try next */
      }
    }
  }

  // Fallback: ask the OS (handles PATH quirks / App Paths).
  if (process.platform === "win32") {
    const r = spawnSync("where.exe", ["nu"], { encoding: "utf8" });
    const line = r.stdout?.split(/\r?\n/).find((l) => l.trim().length > 0);
    if (r.status === 0 && line) return line.trim();
  } else {
    const r = spawnSync("sh", ["-c", "command -v nu"], { encoding: "utf8" });
    const line = r.stdout?.trim();
    if (r.status === 0 && line) return line;
  }

  return undefined;
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

/** Quote one argv token for embedding in a Nushell `^"..."` external invocation. */
export function quoteNuArg(arg: string): string {
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Build a Nushell `-c` program that runs an external command with the same argv.
 * Example: `^"C:\\…\\node.exe" "C:\\…\\cli.js" "arg"`
 */
export function buildNuExternalCommand(argv: string[]): string {
  if (argv.length === 0) {
    throw new Error("nu-require: cannot relaunch with an empty argv");
  }
  const [cmd, ...rest] = argv;
  return `^${quoteNuArg(cmd)}${rest.map((a) => ` ${quoteNuArg(a)}`).join("")}`;
}

function defaultRelaunchArgv(): string[] {
  return [process.execPath, ...process.argv.slice(1)];
}

function fail(
  message: string,
  options: ValidateOptions,
): never {
  if (options.throwOnFailure) {
    throw new Error(message);
  }
  console.error(message);
  process.exit(1);
}

/**
 * Re-exec this CLI under Nushell. Does not return on success.
 */
export function relaunchUnderNushell(
  nuPath: string,
  options: ValidateOptions = {},
): never {
  const argv = options.argv ?? defaultRelaunchArgv();
  const command = buildNuExternalCommand(argv);

  console.error(
    "Nushell is installed, but this shell is not Nushell. Relaunching inside Nushell…",
  );

  const result = spawnSync(nuPath, ["-c", command], {
    stdio: "inherit",
    env: {
      ...process.env,
      [RELAUNCH_ENV]: "1",
    },
  });

  if (result.error) {
    fail(
      `Failed to relaunch under Nushell (${nuPath}): ${result.error.message}`,
      options,
    );
  }

  process.exit(result.status ?? 1);
}

/**
 * Call near process start in Nushell-tailored CLIs.
 *
 * 1. Already under Nushell → return ok
 * 2. Else if `nu` is on PATH (and relaunch enabled) → tell the user and re-exec under `nu`
 * 3. Else → error with homepage (+ optional install hint)
 */
export async function validate(
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const homepage = options.homepage ?? DEFAULT_HOMEPAGE;
  const shouldRelaunch = options.relaunch !== false;

  if (isNushellHost()) {
    return { ok: true, versionHint: process.env.NU_VERSION, relaunched: false };
  }

  const nuPath = findNushellBinary();

  if (shouldRelaunch && nuPath) {
    if (process.env[RELAUNCH_ENV] === "1") {
      fail(
        [
          "nu-require already relaunched under Nushell, but the host still does not look like Nushell.",
          "Refusing to loop. Homepage: " + homepage,
        ].join("\n"),
        options,
      );
    }
    relaunchUnderNushell(nuPath, options);
  }

  const lines = [
    "This tool requires Nushell (nu).",
    `Homepage: ${homepage}`,
    "It is not supported under bash, zsh, or PowerShell as the host shell.",
  ];

  if (!nuPath) {
    lines.push("Nushell was not found on PATH.");
  }

  if (options.offerInstall) {
    lines.push(installHint(process.platform));
  }

  fail(lines.join("\n"), options);
}
