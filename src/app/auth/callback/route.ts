import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getHomePathForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/**
 * Handles magic-link, invite, and PKCE code callbacks from Supabase Auth emails.
 * Signs the user in and redirects them to `/welcome` (if first sign-in) or their role dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=deactivated`);
  }

  if (
    next === "/welcome" ||
    type === "invite" ||
    !profile.full_name ||
    profile.full_name.trim().length === 0
  ) {
    return NextResponse.redirect(`${origin}/welcome`);
  }

  const destination =
    next && next.startsWith("/") ? next : getHomePathForRole(profile.role);

  return NextResponse.redirect(`${origin}${destination}`);
}
