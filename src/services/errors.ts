const GENERIC_ERROR = "The ARK request failed. Check the bot logs for details.";

export function userSafeErrorMessage(error: unknown): string {
  if (error instanceof UserSafeError) {
    return error.message;
  }

  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "The ARK request timed out. Check the provider status and try again.";
  }

  if (error instanceof Error && error.message.startsWith("Timed out waiting for")) {
    return error.message;
  }

  return GENERIC_ERROR;
}

export class UserSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserSafeError";
  }
}
