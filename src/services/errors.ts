const GENERIC_ERROR = "The ARK request failed. Check the bot logs for details.";

export function userSafeErrorMessage(error: unknown): string {
  if (error instanceof UserSafeError) {
    return error.message;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "The ARK request timed out. Check the provider status and try again.";
  }

  return GENERIC_ERROR;
}

export class UserSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserSafeError";
  }
}
