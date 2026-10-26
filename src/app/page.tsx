import { redirect } from "next/navigation";

// Signed-in users will be sent to their dashboard once login is in place.
export default function Home() {
  redirect("/login");
}
