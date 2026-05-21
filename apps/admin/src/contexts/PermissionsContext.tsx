import { api } from '../api';
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface PagePermission {
  read: boolean;
  write: boolean;
  actions: string[];
}

export interface CurrentAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  adminRoleId: string | null;
  adminRole: { id: string; name: string; permissions: Record<string, PagePermission>; isActive: boolean } | null;
  lastLogin: string | null;
  lastActivity: string | null;
  lastIp: string | null;
}

interface PermissionsContextType {
  currentAdmin: CurrentAdmin | null;
  /** undefined = loading | null = super admin (full access) | object = role with permissions */
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
  const [permissions, setPermissions]   = useState<Record<string, PagePermission> | null | undefined>(undefined);
  const [loading, setLoading]           = useState(true);
  const refreshing = useRef(false);

  const refreshPermissions = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setCurrentAdmin(null);
        setPermissions(null);
        return;
      }
      const res = await api.get('/admin/me').catch(() => null);
      if (!res || res.status !== 200) {
        setCurrentAdmin(null);
        setPermissions(null);
        return;
      }
      const data: CurrentAdmin = res.data;
      setCurrentAdmin(data);

      if (!data.adminRole) {
        // No role = Super Admin = full access
        setPermissions(null);
      } else {
        // Use permissions embedded in adminRole directly from /me
        setPermissions((data.adminRole.permissions as Record<string, PagePermission>) ?? null);
      }
    } catch {
      setCurrentAdmin(null);
      setPermissions(null);
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, []);

  /**
   * can() rules:
   *   undefined  → still loading         → false (optimistic lock)
   *   null       → no role = super admin → true
   *   page missing in perms              → not restricted → true
   *   otherwise                          → check flag
   */
  const can = useCallback(
    (page: string, action: string): boolean => {
      if (permissions === undefined) return false;
      if (permissions === null)      return true;
      const p = permissions[page];
      if (!p) return false; // deny by default
      if (action === 'read')  return p.read;
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
