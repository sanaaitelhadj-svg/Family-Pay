import { Router } from 'express';
import { registerSponsorRoutes }     from './sponsor.routes.js';
import { registerBeneficiaryRoutes } from './beneficiary.routes.js';
import { registerMerchantRoutes }    from './merchant.routes.js';

export const mobileRouter = Router();

registerSponsorRoutes(mobileRouter);
registerBeneficiaryRoutes(mobileRouter);
registerMerchantRoutes(mobileRouter);
