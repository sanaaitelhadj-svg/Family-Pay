export const CATEGORIES = {
  PHARMACY:  { label: 'Pharmacie',    icon: '💊', color: '#10b981' },
  FOOD:      { label: 'Alimentation', icon: '🛒', color: '#f97316' },
  CLOTHING:  { label: 'Vêtements',    icon: '👗', color: '#8b5cf6' },
  EDUCATION: { label: 'Éducation',    icon: '📚', color: '#3b82f6' },
  LEISURE:   { label: 'Loisirs',      icon: '🎮', color: '#f59e0b' },
  GENERAL:   { label: 'Général',      icon: '💳', color: '#6b7280' },
} as const;

export type Category = keyof typeof CATEGORIES;
