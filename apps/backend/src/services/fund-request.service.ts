import { Decimal } from '@prisma/client/runtime/library';
import { prismaAdmin, withTenant } from '../lib/prisma.js';
import { FamilyPayError } from '../lib/errors.js';
import { notifyUser } from '../lib/notify.js';

export async function sendFundRequest(
  senderId: string,
  receiverId: string,
  amount: number,
  tenantId: string,
  message?: string,
) {
  if (amount <= 0) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Le montant doit être positif');
  if (senderId === receiverId) throw new FamilyPayError('VALIDATION_ERROR', 400, 'Destinataire invalide');

  // Vérifier que le destinataire existe dans le même tenant
  const receiver = await prismaAdmin.user.findFirst({ where: { id: receiverId, tenantId } });
  if (!receiver) throw new FamilyPayError('NOT_FOUND', 404, 'Destinataire introuvable dans ce tenant');

  const fr = await prismaAdmin.fundRequest.create({
    data: { senderId, receiverId, amount: new Decimal(amount), message },
  });

  notifyUser(receiverId, 'fund_request:new', { requestId: fr.id, senderId, amount, message });
  return fr;
}

export async function listFundRequests(userId: string, role: string) {
  const where = role === 'BENEFICIARY' ? { senderId: userId } : { receiverId: userId };
  return prismaAdmin.fundRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function getFundRequest(requestId: string) {
  const fr = await prismaAdmin.fundRequest.findUnique({ where: { id: requestId } });
  if (!fr) throw new FamilyPayError('FUND_REQUEST_NOT_FOUND', 404, 'Demande introuvable');
  return fr;
}

export async function approveFundRequest(requestId: string, payerId: string, tenantId: string) {
  return prismaAdmin.$transaction(async (tx) => {
    const fr = await tx.fundRequest.findUnique({ where: { id: requestId } });
    if (!fr) throw new FamilyPayError('FUND_REQUEST_NOT_FOUND', 404, 'Demande introuvable');
    if (fr.receiverId !== payerId) throw new FamilyPayError('FORBIDDEN', 403, 'Non autorisé');
    if (fr.status !== 'PENDING') throw new FamilyPayError('FUND_REQUEST_ALREADY_RESPONDED', 400, 'Demande déjà traitée');

    // Wallets avec vérification tenantId explicite (prismaAdmin bypass RLS)
    const payerWallet = await tx.wallet.findFirst({ where: { userId: payerId, tenantId } });
    if (!payerWallet) throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Wallet payeur introuvable');
    if (payerWallet.frozen) throw new FamilyPayError('WALLET_FROZEN', 400, 'Wallet gelé');
    if (Number(payerWallet.balance) < Number(fr.amount)) {
      throw new FamilyPayError('INSUFFICIENT_BALANCE', 400, 'Solde insuffisant');
    }

    const benWallet = await tx.wallet.findFirst({ where: { userId: fr.senderId, tenantId } });
    if (!benWallet) throw new FamilyPayError('WALLET_NOT_FOUND', 404, 'Wallet bénéficiaire introuvable');

    // Débit payeur
    await tx.wallet.update({ where: { id: payerWallet.id }, data: { balance: { decrement: fr.amount } } });
    // Crédit bénéficiaire
    await tx.wallet.update({ where: { id: benWallet.id }, data: { balance: { increment: fr.amount } } });

    // Transaction immuable
    await tx.transaction.create({
      data: {
        tenantId,
        fromWalletId: payerWallet.id,
        toWalletId: benWallet.id,
        amount: fr.amount,
        type: 'FUND_REQUEST_APPROVED',
        status: 'COMPLETED',
        metadata: { fundRequestId: requestId },
      },
    });

    const updated = await tx.fundRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', respondedAt: new Date() },
    });

    notifyUser(fr.senderId, 'fund_request:approved', { requestId, amount: fr.amount });
    notifyUser(payerId, 'fund_request:approved', { requestId, amount: fr.amount });
    return updated;
  });
}

export async function rejectFundRequest(requestId: string, payerId: string) {
  const fr = await prismaAdmin.fundRequest.findUnique({ where: { id: requestId } });
  if (!fr) throw new FamilyPayError('FUND_REQUEST_NOT_FOUND', 404, 'Demande introuvable');
  if (fr.receiverId !== payerId) throw new FamilyPayError('FORBIDDEN', 403, 'Non autorisé');
  if (fr.status !== 'PENDING') throw new FamilyPayError('FUND_REQUEST_ALREADY_RESPONDED', 400, 'Demande déjà traitée');

  const updated = await prismaAdmin.fundRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', respondedAt: new Date() },
  });

  notifyUser(fr.senderId, 'fund_request:rejected', { requestId });
  return updated;
}
