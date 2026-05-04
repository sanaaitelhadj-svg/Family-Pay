import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { getMonthlyReport } from '../services/report.service.js';
import { FamilyPayError } from '../lib/errors.js';

export async function monthlyReportHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id: userId, tenantId } = req.user!;
  const year = parseInt(req.query.year as string);
  const month = parseInt(req.query.month as string);

  if (!year || !month || month < 1 || month > 12) {
    throw new FamilyPayError('VALIDATION_ERROR', 400, 'year and month (1-12) are required');
  }

  const report = await getMonthlyReport(userId, tenantId, year, month);
  res.json(report);
}
