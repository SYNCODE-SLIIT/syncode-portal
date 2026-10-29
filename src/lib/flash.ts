import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE } from "./flash-cookie";

/** Leaves a success message for the next page to show as a pop-up. Call it just before `redirect()`. */
export async function setFlash(message: string) {
  // Next.js URL-encodes the value; the browser side decodes it
  (await cookies()).set(FLASH_COOKIE, message, {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
