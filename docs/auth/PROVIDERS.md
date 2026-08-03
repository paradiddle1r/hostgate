# Production social-login setup

HostGate uses Supabase Auth for every web login so all providers share the same
PKCE callback, session cookies, onboarding decision, and tenant RLS identity.

## Fixed URLs

- Supabase project: `xwikaqpdulkscdysgxri`
- HostGate callback: `https://hostgate.app/auth/callback`
- Provider callback: `https://xwikaqpdulkscdysgxri.supabase.co/auth/v1/callback`
- Supabase redirect allow list must include `https://hostgate.app/auth/callback`

Provider credentials are secrets. Keep them in the provider consoles and
Supabase Dashboard; do not add them to this repository or Vercel.

## Facebook

1. In Meta for Developers, create or reuse a Facebook app and add the Facebook
   Login product/use case.
2. Set the Valid OAuth Redirect URI to the provider callback above (exactly,
   with no trailing slash).
3. Enable `public_profile` and `email`; Supabase needs the user's email.
4. Complete the app icon, privacy policy (`https://hostgate.app/privacy`), terms
   (`https://hostgate.app/terms`), and app-domain settings.
5. In Supabase Dashboard > Authentication > Sign In / Providers > Facebook,
   enter the App ID and App Secret, enable Facebook, and save.
6. Test first with a Meta app-role account, then put the Meta app in Live mode
   before claiming the login works for the public.

## LINE

LINE is a Supabase Custom OAuth2 provider; its identifier must remain
`custom:line` because that is what `AuthForm` sends.

1. In LINE Developers, create a **LINE Login** channel of type Web app for the
   intended operating region.
2. Set its callback URL to the provider callback above.
3. Apply for LINE OpenID Connect email permission if a future integration will
   consume LINE ID-token email. The application screenshot should show the
   HostGate consent/privacy explanation.
4. In Supabase Dashboard > Authentication > Sign In / Providers > Custom OAuth
   Providers, create a **manual OAuth2** provider:
   - Identifier: `custom:line`
   - Client ID: LINE Channel ID
   - Client secret: LINE Channel secret
   - Authorization URL: `https://access.line.me/oauth2/v2.1/authorize`
   - Token URL: `https://api.line.me/oauth2/v2.1/token`
   - UserInfo URL: `https://api.line.me/oauth2/v2.1/userinfo`
   - Scopes: `profile openid`
   - Email optional: enabled
5. Enable and save the custom provider.

Do not configure LINE web login as a Supabase Custom OIDC provider. LINE signs
web-login ID tokens with HS256, while Supabase's custom OIDC verifier currently
accepts the ES256 algorithm advertised by LINE's discovery document. The result
is `id token signed with unsupported algorithm`. Manual OAuth2 makes Supabase
use LINE's standard UserInfo endpoint instead. That endpoint returns the LINE
identifier, display name, and profile image but not email, so email must remain
optional. Retrieving LINE email would require a dedicated server-side LINE
callback that verifies the ID token with LINE's verification endpoint.

## Production verification

Use a fresh/incognito browser for each provider:

1. Open `https://hostgate.app/signup` and complete the provider consent.
2. Confirm the browser returns through `/auth/callback` and lands on
   `/onboarding` for a new identity.
3. Finish onboarding, sign out, and use the same provider at `/login`.
4. Confirm it lands on `/app` and sees only its own tenant.
5. Repeat once with an existing verified email used by another social provider.
   Supabase should automatically link the new identity to the existing user;
   confirm that the same tenant membership remains visible.

Current provider state can be checked without secrets through the Supabase Auth
`/settings` endpoint. Do not mark a provider live based only on its button being
visible; complete the end-to-end consent test above.
