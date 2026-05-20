import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { api } from '../api';

interface PagePermission {
  read: boolean;
  write: boolean;
  actions: string[];
}

interface CurrentAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  adminRole?: { id: string; name: string; permissions: Record<string, PagePermission> } | null;
}

interface PermissionsContextType {
  currentAdmin: CurrentAdmin | null;
  permissions: Record<string, PagePermission> | null | undefined;
  loading: boolean;
  can: (page: string, action: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  currentAdmin: null,
  permissions: null,
  loading: false,
  can: () => true,
  refreshPermissions: async () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PagePermission> | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const refreshPermissions = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setPermissions(null);
      setCurrentAdmin(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/admin/me');
      const data = res.data as CurrentAdmin | null;
      if (data) {
        setCurrentAdmin(data);
        setPermissions(data.adminRole?.permissions ?? null);
      } else {
        setPermissions(null);
      }
    } catch {
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const can = useCallback((page: string, action: string): boolean => {
    // undefined = not yet loaded = optimistically allow (will update after load)
    if (permissions === undefined || permissions === null) return true;
    const p = permissions[page];
    if (!p) return true; // page not configured = unrestricted
    if (action === 'read') return p.read;
    if (action === 'write') return p.write;
    return p.actions?.includes(action) ?? false;
  }, [permissions]);

  return (
    <PermissionsContext.Provider value={{ currentAdmin, permissions, loading, can, refreshPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
