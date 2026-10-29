"use client";

import { useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import { Toaster as Sonner, toast } from "sonner";
import { FLASH_COOKIE } from "@/lib/flash-cookie";

/** White pop-up messages in the bottom-right corner that close by themselves after a few seconds. */
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      duration={4000}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-black/5 !bg-white !text-neutral-900 !shadow-xl !font-sans",
          description: "!text-neutral-500",
        },
      }}
    />
  );
}

/** Shows `message` as a success pop-up whenever it's set. Renders nothing itself. */
export function NoticeToast({ message }: { message: string }) {
  // A stable id stops the same notice appearing twice when effects run twice in development
  const id = useId();
  useEffect(() => {
    toast.success(message, { id });
  }, [message, id]);
  return null;
}

/**
 * Shows the message a server action left in the flash cookie before redirecting
 * (e.g. "Client created."), then clears it so it only appears once.
 */
export function FlashToast() {
  const pathname = usePathname();
  useEffect(() => {
    const entry = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
    if (!entry) return;
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
    const message = decodeURIComponent(entry.slice(FLASH_COOKIE.length + 1));
    if (message) toast.success(message, { id: `flash-${message}` });
  }, [pathname]);
  return null;
}
