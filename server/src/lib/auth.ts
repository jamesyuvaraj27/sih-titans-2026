import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';

const key = new TextEncoder().encode(env.jwtSecret);

export type SystemRole = 'LEARNER' | 'MANAGER' | 'DEPT_ADMIN' | 'SUPER_ADMIN' | 'AUDITOR';

export interface Session {
  sub: string;
  role: SystemRole;
  departmentId: string;
  name: string;
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, departmentId: s.departmentId, name: s.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(key);
}

export async function verifySession(token: string): Promise<Session> {
  const { payload } = await jwtVerify(token, key);
  return {
    sub: String(payload.sub),
    role: payload.role as SystemRole,
    departmentId: String(payload.departmentId),
    name: String(payload.name),
  };
}
