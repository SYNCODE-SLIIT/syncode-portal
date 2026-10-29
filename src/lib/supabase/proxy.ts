import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

// Refreshes the signed-in user's session cookie on every request.
// Route protection is added on top of this in the login step.
export async function updateSession(request: NextRequest) {
  // Supabase falls back to the Site URL (the home page) when a redirect URL isn't
  // on its allow-list. Forward sign-in codes from there to the callback handler.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the session and refreshes it if it has expired.
  // Nothing may run between creating the client and this call.
  const { data } = await supabase.auth.getClaims();

  // Optimistic check: send signed-out visitors straight to /login. Pages still verify
  // the user and their role on the server; this only avoids loading a page first.
  const isProtected =
    pathname === "/" || PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!data?.claims && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

const PROTECTED_PREFIXES = ["/admin", "/dashboard", "/projects", "/requests", "/invoices", "/account", "/welcome"];
