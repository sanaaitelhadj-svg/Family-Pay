import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api';

interface PagePermission {
  read: boolean;
  write: boolean;
  actions: string[];
}

interface PermissionsContextType {
  permissions: Record<string, PagePermission> | null;
  loading: boolean;
  can: (page: string, action: 'read' | 'write' | string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  loading: true,
  can: () => true,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Record<string, PagePermission> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/me')
      .then((res: any) => {
        const role = res.data?.adminRole;
        // No role = super admin = full access (null means unrestricted)
        setPermissions(role?.permissions ?? null);
      })
      .catch(() => setPermissions(null))
      .finally(() => setLoading(false));
  }, []);

  const can = (page: string, action: string): boolean => {
    // null = no role = full access
    if (permissions === null) return true;
    const p = permissions[page];
    if (!p) return false;
    if (action === 'read') return p.read;
    if (action === 'write') return p.write;
    return p.actions?.includes(action) ?? false;
  };

  return (
    <PermissionsContext.Provider value={{ permissions, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
