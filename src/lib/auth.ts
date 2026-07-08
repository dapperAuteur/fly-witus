import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { genericOAuth } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env } from "./env";
import { sendMagicLinkEmail } from "./mailer";

export const auth = betterAuth({
  appName: "Fly WitUS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),

  // v3 §1: magic link only. No emailAndPassword block, no socialProviders.
  user: {
    additionalFields: {
      // Surface to client so feature gates (e.g. /admin) can read isAdmin
      // without a round-trip. input: false → client cannot set this on signup.
      isAdmin: { type: "boolean", defaultValue: false, input: false },
      accountTier: { type: "string", defaultValue: "free", input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // v3 §5: ADMIN_EMAIL (bam@awews.com) gets is_admin=true on first sign-in.
        // Avoids manual SQL update + lets /admin/* gate work the moment bam logs in.
        // Case-insensitive compare because email canonicalization is downstream.
        after: async (user) => {
          if (user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
            await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
          }
        },
      },
    },
  },

  plugins: [
    magicLink({
      // v3 §1: 15-minute expiry, single use.
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ to: email, url });
      },
    }),
    // "Sign in with WitUS" — the ecosystem IdP as an OIDC provider. Added only
    // once WITUS_OIDC_CLIENT_ID is set, so a missing env never breaks the build
    // or the magic-link flow. The ADMIN_EMAIL → is_admin promotion in the
    // user.create.after hook applies to WitUS-SSO users too.
    ...(env.WITUS_OIDC_CLIENT_ID
      ? [
          genericOAuth({
            config: [
              {
                providerId: "witus",
                discoveryUrl:
                  env.WITUS_OIDC_DISCOVERY_URL ??
                  "https://accounts.witus.online/api/idp/.well-known/openid-configuration",
                clientId: env.WITUS_OIDC_CLIENT_ID,
                clientSecret: env.WITUS_OIDC_CLIENT_SECRET ?? "",
                scopes: ["openid", "email", "profile"],
                pkce: true,
              },
            ],
          }),
        ]
      : []),
    // Required for Next.js App Router cookie handling on signed-in mutations.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
