import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { getPayerDashboard, getPartnerStats } from '../services/dashboard.service.js';

export async function payerDashboardHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id: userId, tenantId } = req.user!;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
  const dashboard = await getPayerDashboard(userId, tenantId);
  res.json(dashboard);
}

export async function partnerDashboardHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id: userId, tenantId } = req.user!;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
  const stats = await getPartnerStats(userId, tenantId, startDate, endDate);
  res.json(stats);
}
