import { hasWitusSso } from "@/lib/env";
import { LoginForm } from "./LoginForm";

// Server component: reads the server-only `hasWitusSso` flag so the "Sign in
// with WitUS" button only renders once the OIDC client is provisioned. The
// interactive magic-link form + its status states live in the client LoginForm.
export default function LoginPage() {
  return <LoginForm witusSsoEnabled={hasWitusSso} />;
}
