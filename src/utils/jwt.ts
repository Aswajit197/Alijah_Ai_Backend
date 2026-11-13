import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface SuperAdminTokenPayload {
  type: 'SUPER_ADMIN';
  sub: string;
  email: string;
  name: string;
}

export interface TenantUserTokenPayload {
  type: 'TENANT_USER';
  sub: string;
  tenantId: string;
  roleId: string;
  roleSlug: string;
  email: string;
  name: string;
}

export type TokenPayload = SuperAdminTokenPayload | TenantUserTokenPayload;

export function signSuperAdminToken(payload: Omit<SuperAdminTokenPayload, 'type'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as any,
  };
  return jwt.sign({ ...payload, type: 'SUPER_ADMIN' }, env.JWT_SECRET, options);
}

export function signTenantUserToken(payload: Omit<TenantUserTokenPayload, 'type'>): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as any,
  };
  return jwt.sign({ ...payload, type: 'TENANT_USER' }, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
