import "server-only";
import { cache } from "react";
import { getSession, type SessionPayload } from "./session";

export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  return await getSession();
});
