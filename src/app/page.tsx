import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getHomePathForRole, getOptionalAuth } from "@/lib/auth";

async function HomeRedirect(): Promise<null> {
  const session = await getOptionalAuth();
  if (!session) {
    redirect("/login");
  }
  redirect(getHomePathForRole(session.profile.role));
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeRedirect />
    </Suspense>
  );
}
