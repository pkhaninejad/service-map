import type { Service } from "../schema";
import { ProbeConfigError, type ProbeClient, type ProbeResponse } from "../probe.js";

type ErrorResult = { error: string };

// ── listProbes ──────────────────────────────────────────────────────────────
//
// Discovery: which nodes are live-callable, their operations, and whether the
// referenced credential profile is actually configured on this server.

type ProbeListing = {
  serviceId: string;
  name: string;
  profile: string;
  profileConfigured: boolean;
  operations: { operation: string; method: string; path: string; description?: string; write: boolean }[];
};

export function listProbes(nodes: Service[], configuredProfiles: string[]): ProbeListing[] {
  return nodes
    .filter((n) => n.probe)
    .map((n) => ({
      serviceId: n.id,
      name: n.name,
      profile: n.probe!.profile,
      profileConfigured: configuredProfiles.includes(n.probe!.profile),
      operations: Object.entries(n.probe!.operations).map(([operation, op]) => ({
        operation,
        method: op.method,
        path: op.path,
        description: op.description,
        write: op.write ?? false,
      })),
    }));
}

// ── callService ───────────────────────────────────────────────────────────────

export type CallServiceArgs = {
  serviceId: string;
  operation: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  allowWrite?: boolean;
};

type CallServiceResult = (ProbeResponse & { serviceId: string; operation: string }) | ErrorResult;

/** Substitute {name} placeholders in a path template; report any left unfilled. */
function fillPath(template: string, params: Record<string, string>): { path: string } | ErrorResult {
  const missing: string[] = [];
  const path = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (params[key] === undefined || params[key] === "") {
      missing.push(key);
      return `{${key}}`;
    }
    return encodeURIComponent(params[key]);
  });
  if (missing.length) return { error: `Missing required path param(s): ${missing.join(", ")}` };
  return { path };
}

export async function callService(
  nodes: Service[],
  client: ProbeClient,
  args: CallServiceArgs,
): Promise<CallServiceResult> {
  const node = nodes.find((n) => n.id === args.serviceId);
  if (!node) {
    const probeable = nodes.filter((n) => n.probe).map((n) => n.id);
    return {
      error: `Unknown service id "${args.serviceId}".` +
        (probeable.length ? ` Callable services: ${probeable.join(", ")}.` : ""),
    };
  }
  if (!node.probe) {
    return { error: `Service "${args.serviceId}" is not live-callable (no probe block). Use list_probes to see what is.` };
  }

  const op = node.probe.operations[args.operation];
  if (!op) {
    const ops = Object.keys(node.probe.operations).join(", ") || "(none)";
    return { error: `Unknown operation "${args.operation}" on "${args.serviceId}". Available: ${ops}.` };
  }

  if (op.write && !args.allowWrite) {
    return {
      error: `Operation "${args.operation}" is a mutating (write) call. Re-invoke with allowWrite: true to confirm.`,
    };
  }

  const filled = fillPath(op.path, args.params ?? {});
  if ("error" in filled) return filled;

  try {
    const res = await client.request({
      profile: node.probe.profile,
      method: op.method,
      path: filled.path,
      query: args.query,
      body: args.body,
    });
    return { serviceId: args.serviceId, operation: args.operation, ...res };
  } catch (err) {
    if (err instanceof ProbeConfigError) return { error: err.message };
    const e = err as { name?: string; message?: string };
    if (e.name === "AbortError") return { error: `Request timed out.` };
    return { error: `Call failed: ${e.message ?? String(err)}` };
  }
}
