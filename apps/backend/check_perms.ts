import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.adminRole.findMany({ select: { name: true, permissions: true } })
  .then(roles => {
    console.log(JSON.stringify(roles, null, 2));
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
