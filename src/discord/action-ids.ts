export type ArkButtonAction = "restart" | "rollback" | "restore" | "dino-wipe";
export type ArkButtonDecision = "confirm" | "cancel";

export interface ArkButtonActionId {
  action: ArkButtonAction;
  targetId?: string;
  decision: ArkButtonDecision;
  userId: string;
}

const namespace = "ark";

export function createActionId(input: ArkButtonActionId): string {
  const parts = [
    namespace,
    encodeURIComponent(input.action),
    encodeURIComponent(input.targetId ?? "-"),
    encodeURIComponent(input.decision),
    encodeURIComponent(input.userId)
  ];
  const customId = parts.join(":");

  if (customId.length > 100) {
    throw new Error("Discord action id is too long.");
  }

  return customId;
}

export function parseActionId(customId: string): ArkButtonActionId | undefined {
  const [actualNamespace, action, targetId, decision, userId, extra] = customId.split(":");
  if (actualNamespace !== namespace || extra !== undefined || !action || !targetId || !decision || !userId) {
    return undefined;
  }

  const parsedAction = decodeURIComponent(action);
  const parsedDecision = decodeURIComponent(decision);

  if (!isAction(parsedAction) || !isDecision(parsedDecision)) {
    return undefined;
  }

  return {
    action: parsedAction,
    targetId: decodeURIComponent(targetId) === "-" ? undefined : decodeURIComponent(targetId),
    decision: parsedDecision,
    userId: decodeURIComponent(userId)
  };
}

function isAction(value: string): value is ArkButtonAction {
  return value === "restart" || value === "rollback" || value === "restore" || value === "dino-wipe";
}

function isDecision(value: string): value is ArkButtonDecision {
  return value === "confirm" || value === "cancel";
}
