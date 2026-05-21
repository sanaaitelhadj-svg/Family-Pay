import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

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
  adminRoleId: string | null;
  adminRole: { id: string; name: string } | null;
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
  permissions: undefined,
  loading: true,
  can: () => false,
  refreshPermissions: async () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PagePermission> | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef(false);

  const refreshPermissions = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setPermissions(null);
        setCurrentAdmin(null);
        setLoading(false);
        refreshing.current = false;
        return;
      }
      const res = await fetch(`${API}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setPermissions(null);
        setCurrentAdmin(null);
        setLoading(false);
        refreshing.current = false;
        return;
      }
      const data = await res.json();
      setCurrentAdmin(data);

      if (!data.adminRoleId || !data.adminRole) {
        setPermissions(null);
      } else {
        const roleRes = await fetch(`${API}/admin/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (roleRes.ok) {
          const roles: Array<{ id: string; permissions: Record<string, PagePermission> }> = await roleRes.json();
          const myRole = roles.find((r) => r.id === data.adminRoleId);
          setPermissions(myRole?.permissions ?? null);
        } else {
          setPermissions(null);
        }
      }
    } catch {
      setPermissions(null);
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, []);

  const can = useCallback(
    (page: string, action: string): boolean => {
      if (permissions === undefined) return false;
      if (permissions === null) return true;
      const p = permissions[page];
      if (!p) return true;
      if (action === 'read') return p.read;
      if (action === 'write') return p.write;
      return p.actions?.includes(action) ?? false;
    },
    [permissions],
  );

  return (
    <PermissionsContext.Provider value={{ currentAdmin, permissions, loading, can, refreshPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
