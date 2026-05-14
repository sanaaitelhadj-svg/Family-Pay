import { Router, Request, Response, NextFunction } from 'express';
import { AllocationService } from './allocation.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import {
  CreateAllocationSchema,
  IncreaseAllocationAmountSchema,
  UpdateAllocationStatusSchema,
} from './allocation.schema.js';

export const allocationRouter = Router();

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

allocationRouter.get('/me', authenticate(['BENEFICIARY']), wrap(async (req, res) => {
  const allocations = await AllocationService.listByBeneficiary(req.user!.profileId);
  res.json({ allocations });
}));

allocationRouter.post('/', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const input = CreateAllocationSchema.parse(req.body);
  const allocation = await AllocationService.create(req.user!.profileId, req.user!.userId, input);
  res.status(201).json({ allocation });
}));

allocationRouter.get('/', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const { beneficiaryId } = req.query;
  const allocations = await AllocationService.listBySponsor(
    req.user!.profileId,
    typeof beneficiaryId === 'string' ? beneficiaryId : undefined,
  );
  res.json({ allocations });
}));

allocationRouter.get('/:id', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const allocation = await AllocationService.getOne(req.user!.profileId, req.params['id'] as string);
  res.json({ allocation });
}));

allocationRouter.patch('/:id/amount', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const input = IncreaseAllocationAmountSchema.parse(req.body);
  const allocation = await AllocationService.increaseAmount(
    req.user!.profileId, req.user!.userId, req.params['id'] as string, input,
  );
  res.json({ allocation });
}));

allocationRouter.patch('/:id/status', authenticate(['SPONSOR']), wrap(async (req, res) => {
  const input = UpdateAllocationStatusSchema.parse(req.body);
  const allocation = await AllocationService.updateStatus(
    req.user!.profileId, req.user!.userId, req.params['id'] as string, input,
  );
  res.json({ allocation });
}));
