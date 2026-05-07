import { Request, Response, NextFunction } from 'express';
import { prismaAdmin } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';

// ── GET /api/admin/settings/conditions ──────────────────────────────────────
export async function listConditions(_req: Request, res: Response, next: NextFunction) {
  try {
    const conditions = await prismaAdmin.partnershipCondition.findMany({
      orderBy: { order: 'asc' },
    });
    res.json({ conditions });
  } catch (err) { next(err); }
}

// ── POST /api/admin/settings/conditions ─────────────────────────────────────
export async function createCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, isRequired, order } = req.body;
    if (!title?.trim() || !description?.trim()) {
      throw new FamilyPayError('VALIDATION_ERROR', 400, 'Titre et description requis');
    }
    const condition = await prismaAdmin.partnershipCondition.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        isRequired: isRequired !== false,
        order: Number(order) || 0,
      },
    });
    res.status(201).json({ condition });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/settings/conditions/:id ────────────────────────────────
export async function updateCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { title, description, isRequired, order, isActive } = req.body;

    const existing = await prismaAdmin.partnershipCondition.findUnique({ where: { id } });
    if (!existing) throw new FamilyPayError('NOT_FOUND', 404, 'Condition introuvable');

    const condition = await prismaAdmin.partnershipCondition.update({
      where: { id },
      data: {
        ...(title !== undefined       && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(isRequired !== undefined  && { isRequired }),
        ...(order !== undefined       && { order: Number(order) }),
        ...(isActive !== undefined    && { isActive }),
      },
    });
    res.json({ condition });
  } catch (err) { next(err); }
}

// ── DELETE /api/admin/settings/conditions/:id ───────────────────────────────
export async function deleteCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const existing = await prismaAdmin.partnershipCondition.findUnique({ where: { id } });
    if (!existing) throw new FamilyPayError('NOT_FOUND', 404, 'Condition introuvable');

    await prismaAdmin.partnershipCondition.delete({ where: { id } });
    res.json({ message: 'Condition supprimée' });
  } catch (err) { next(err); }
}
