import { Response } from 'express';
import { AuthRequest } from '../middleware/authenticate.js';
import { getTransactions } from '../services/transaction.service.js';

export async function transactionHistoryHandler(req: AuthRequest, res: Response): Promise<void> {
  const { id: userId, tenantId } = req.user!;
  const {
    startDate, endDate, beneficiaryId, envelopeId, type,
    page, limit,
  } = req.query as Record<string, string | undefined>;

  const result = await getTransactions(userId, tenantId, {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    beneficiaryId,
    envelopeId,
    type,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
  });
  res.json(result);
}
