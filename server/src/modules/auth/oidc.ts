import { prisma } from '../../lib/db.js';
import { signSession } from '../../lib/auth.js';

export interface OidcPublicConfig {
  configured: boolean;
  providerName: string;
  issuerUrl?: string;
  scope: string;
  guidance: {
    requiredEnvVars: string[];
    standard: string;
    roleProvisioning: string;
  };
}

export function getOidcStatus(): OidcPublicConfig {
  const issuerUrl = process.env.OIDC_ISSUER_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const isConfigured = Boolean(issuerUrl && clientId && clientSecret);

  return {
    configured: isConfigured,
    providerName: process.env.OIDC_PROVIDER_NAME || 'Parichay / MeriPehchan (National SSO)',
    issuerUrl: isConfigured ? issuerUrl : undefined,
    scope: 'openid email profile',
    guidance: {
      requiredEnvVars: [
        'OIDC_ISSUER_URL (e.g. https://parichay.nic.in)',
        'OIDC_CLIENT_ID',
        'OIDC_CLIENT_SECRET (stored securely in server environment only)',
        'OIDC_REDIRECT_URI (e.g. http://localhost:4000/api/auth/sso/callback)',
      ],
      standard: 'OpenID Connect Core 1.0 with Authorization Code Flow',
      roleProvisioning: 'New users authenticated via institutional SSO automatically receive application role LEARNER.',
    },
  };
}

/**
 * Initiates the OIDC authorization code flow.
 */
export function getOidcAuthorizationUrl(): { url?: string; configured: boolean; message?: string } {
  const status = getOidcStatus();
  if (!status.configured) {
    return {
      configured: false,
      message:
        'Institutional SSO is not configured on this instance. Please set OIDC_ISSUER_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET.',
    };
  }

  const issuer = process.env.OIDC_ISSUER_URL!;
  const clientId = process.env.OIDC_CLIENT_ID!;
  const redirectUri = process.env.OIDC_REDIRECT_URI || 'http://localhost:4000/api/auth/sso/callback';
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = `${issuer}/protocol/openid-connect/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}`;

  return {
    configured: true,
    url: authUrl,
  };
}

/**
 * Handles callback from identity provider.
 * When real credentials are configured, exchanges code for token and provisions learner.
 */
export async function processOidcCallback(code: string): Promise<{ token: string; official: any }> {
  const status = getOidcStatus();
  if (!status.configured) {
    throw new Error('Institutional SSO is not configured on this instance');
  }

  const issuer = process.env.OIDC_ISSUER_URL!;
  const clientId = process.env.OIDC_CLIENT_ID!;
  const clientSecret = process.env.OIDC_CLIENT_SECRET!;
  const redirectUri = process.env.OIDC_REDIRECT_URI || 'http://localhost:4000/api/auth/sso/callback';

  // 1. Exchange authorization code for tokens
  const tokenEndpoint = `${issuer}/protocol/openid-connect/token`;
  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`IdP token exchange failed with HTTP ${tokenRes.status}`);
  }

  const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw new Error('No id_token received from IdP');

  // 2. Fetch UserInfo
  const userInfoRes = await fetch(`${issuer}/protocol/openid-connect/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) throw new Error('Failed to retrieve user info from IdP');
  const userInfo = (await userInfoRes.json()) as { email: string; name?: string; sub: string };

  // 3. Find or provision Official with LEARNER role
  let official = await prisma.official.findUnique({
    where: { email: userInfo.email.toLowerCase() },
  });

  if (!official) {
    const defaultDept = await prisma.department.findFirst({ where: { id: 'DEPT.MOSPI.HQ' } });
    const defaultRoleProfile = await prisma.roleProfile.findFirst({ where: { id: 'ROLE.SSS.JSO' } });

    official = await prisma.official.create({
      data: {
        id: `off_sso_${Date.now()}`,
        nameEn: userInfo.name || 'Institutional Learner',
        email: userInfo.email.toLowerCase(),
        passwordHash: 'SSO_MANAGED_ACCOUNT_NO_LOCAL_PASSWORD',
        role: 'LEARNER', // Strict security: all SSO provisions default to LEARNER
        designation: 'Statistical Officer',
        employeeCode: `SSO-${userInfo.sub.slice(-6).toUpperCase()}`,
        preferredLang: 'en',
        dateOfJoining: new Date(),
        departmentId: defaultDept?.id || 'DEPT.MOSPI.HQ',
        roleProfileId: defaultRoleProfile?.id || 'ROLE.SSS.JSO',
      },
    });
  }

  const token = await signSession({
    sub: official.id,
    role: official.role,
    departmentId: official.departmentId,
    name: official.nameEn,
  });

  return { token, official };
}
