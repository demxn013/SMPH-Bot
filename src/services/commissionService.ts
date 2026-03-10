import { prisma } from './prisma.js';

export const calculateCommission = async (providerId: string, price: number): Promise<{ commission: number; netAmount: number; percent: number }> => {
  const completedDeals = await prisma.deal.aggregate({
    where: { providerId, status: 'Completed' },
    _sum: { netAmount: true }
  });

  const earnings = Number(completedDeals._sum.netAmount ?? 0);

  const tier = await prisma.commissionTier.findFirst({
    where: {
      minEarnings: { lte: earnings },
      OR: [{ maxEarnings: null }, { maxEarnings: { gte: earnings } }]
    },
    orderBy: { minEarnings: 'desc' }
  });

  const percent = Number(tier?.commissionPercent ?? 10);
  const commission = Number((price * (percent / 100)).toFixed(2));
  const netAmount = Number((price - commission).toFixed(2));

  return { commission, netAmount, percent };
};
