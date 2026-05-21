import { prisma } from './prisma.js';

const ALL_PAGES = ['dashboard','merchants','sponsors','beneficiaries','transactions',
  'fraud','subscriptions','commissions','admins','roles','auditLogs'];
const ALL_ACTIONS = ['*','add','edit','delete','suspend','approve','reject','assign-role','export'];
const fullAccess   = Object.fromEntries(ALL_PAGES.map(p => [p, { read: true,  write: true,  actions: ALL_ACTIONS }]));
const HIDDEN_FOR_SUPERVISEUR = ['commissions', 'auditLogs'];
const readOnly     = Object.fromEntries(ALL_PAGES.map(p => [p, {
  read:    !HIDDEN_FOR_SUPERVISEUR.includes(p),
  write:   false,
  actions: [],
}]));
const financePerms = Object.fromEntries(ALL_PAGES.map(p => {
  if (['commissions','subscriptions'].includes(p)) return [p, { read: true, write: true, actions: ['edit'] }];
  if (p === 'admins' || p === 'roles')             return [p, { read: false, write: false, actions: [] }];
  return [p, { read: true, write: false, actions: [] }];
}));

function getPermsByName(name: string): unknown {
  const n = name.toLowerCase().replace(/\s+/g, '-');
  if (n === 'super-admin' || n === 'super_admin') return fullAccess;
  if (n === 'finance')                            return financePerms;
  return readOnly;
}

export async function seedRoles(): Promise<void> {
  try {
    const roles = await prisma.adminRole.findMany({ select: { id: true, name: true } });
    for (const role of roles) {
      await prisma.adminRole.update({
        where: { id: role.id },
        data:  { permissions: getPermsByName(role.name) as any },
      });
    }
    if (roles.length > 0) {
      console.log('[seedRoles] Updated ' + roles.length + ' role(s): ' + roles.map((r: any) => r.name).join(', '));
    }
  } catch (err) {
    console.error('[seedRoles] Failed:', err);
  }
}
