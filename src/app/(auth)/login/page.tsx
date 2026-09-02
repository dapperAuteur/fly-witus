import { hasWitusSso, witusSilentSsoEndpoint } from "@/lib/env";
import { LoginForm } from "./LoginForm";

// Server component: reads the server-only `hasWitusSso` flag so the "Sign in with WitUS"
// button only renders once the OIDC client is provisioned. The interactive magic-link form +
// its status states live in the client LoginForm.
//
// `witusSilentSsoEndpoint` is resolved HERE, on the server, and handed down: the silent
// "Continue as <name>" probe must never build the IdP URL from client-side env, and it is null
// whenever the app is not a configured OIDC client, which keeps the check dark.
export default function LoginPage() {
  return (
    <LoginForm
      witusSsoEnabled={hasWitusSso}
      witusSilentCheckUrl={witusSilentSsoEndpoint}
    />
  );
}
