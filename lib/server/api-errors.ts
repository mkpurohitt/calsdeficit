import "server-only";

/**
 * Turns a provider/database error into something safe to show a user.
 *
 * Every AI route used to return `error.message` verbatim, so a Vertex failure
 * surfaced in the chat bubble as a wall of raw Google JSON — for example
 * `{"error":{"code":403,"message":"Lightning dunning decision is deny for
 * project: projects/1004645410248"}}`. That leaks the project number, is
 * meaningless to a user, and looks broken. The full error still goes to the
 * server log, which is where it belongs.
 *
 * The wording deliberately distinguishes "our fault, nothing you can do" from
 * "try again" so people aren't left retrying something that can't succeed.
 */

export interface FriendlyError {
  /** Safe to render in the UI. */
  message: string;
  /** HTTP status to answer with. */
  status: number;
  /** Short tag for logs/metrics — never sent to the client. */
  kind:
    | "billing"
    | "quota"
    | "permission"
    | "model-missing"
    | "network"
    | "too-large"
    | "unknown";
}

/**
 * Google's billing enforcement ("dunning" is the collections term) answers 403
 * long before the model is reached, so no amount of retrying helps — the
 * billing account itself needs attention.
 */
const BILLING = /dunning|billing|BILLING_DISABLED|billing.account|payment/i;
const QUOTA = /RESOURCE_EXHAUSTED|quota|rate.?limit|429|too many requests/i;
const PERMISSION = /PERMISSION_DENIED|forbidden|not authorized|403/i;
const MODEL_MISSING = /NOT_FOUND|was not found|404|is not supported|unsupported model/i;
const NETWORK = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|network|timeout|aborted/i;
const TOO_LARGE = /payload|too large|request entity|exceeds the maximum|413/i;

export function classifyError(error: unknown): FriendlyError {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  // Billing is checked first: a suspended account also reports as a 403
  // PERMISSION_DENIED, and "your account needs attention" is far more useful
  // than "permission denied".
  if (BILLING.test(raw)) {
    return {
      kind: "billing",
      status: 503,
      message:
        "The AI service is unavailable right now because of a billing problem on our side. " +
        "Nothing is wrong with your account — please try again shortly.",
    };
  }
  if (QUOTA.test(raw)) {
    return {
      kind: "quota",
      status: 429,
      message: "We're handling a lot of requests right now. Give it a minute and try again.",
    };
  }
  if (MODEL_MISSING.test(raw)) {
    return {
      kind: "model-missing",
      status: 503,
      message: "The AI service is misconfigured on our side. We've been alerted — please try again later.",
    };
  }
  if (PERMISSION.test(raw)) {
    return {
      kind: "permission",
      status: 503,
      message: "The AI service rejected the request on our side. We've been alerted — please try again later.",
    };
  }
  if (TOO_LARGE.test(raw)) {
    return {
      kind: "too-large",
      status: 413,
      message: "That file is too large to process. Try a shorter clip or a smaller photo.",
    };
  }
  if (NETWORK.test(raw)) {
    return {
      kind: "network",
      status: 504,
      message: "Couldn't reach the AI service. Check your connection and try again.",
    };
  }
  return {
    kind: "unknown",
    status: 500,
    message: "Something went wrong on our side. Please try again.",
  };
}

/**
 * Logs the real error with its route tag and returns the sanitized version.
 * Call this instead of reaching for `error.message` in a route handler.
 */
export function reportError(route: string, error: unknown): FriendlyError {
  const friendly = classifyError(error);
  // Full detail server-side — this is the only place it should ever appear.
  console.error(`[${route}] ${friendly.kind}:`, error);
  return friendly;
}
