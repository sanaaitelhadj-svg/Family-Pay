import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import { AuthRequest } from '../middleware/authenticate.js';
import { FamilyPayError } from '../lib/errors.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role, firstName, lastName, tenantId, phone } = req.body;
    if (!email || !password || !role || !firstName || !lastName || !tenantId)
      throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing required fields');
    const result = await authService.register({ email, password, role, firstName, lastName, tenantId, phone });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing email or password');
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Missing refreshToken');
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    await authService.logout(req.user.id, req.body.refreshToken ?? '');
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new FamilyPayError('UNAUTHORIZED', 401, 'Not authenticated');
    const user = await authService.me(req.user.id, req.user.tenantId);
    res.json(user);
  } catch (err) { next(err); }
}
