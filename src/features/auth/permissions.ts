import type { Page } from '../../types/app'
import type { AuthUser } from './authContext'

export type AppRole = 'guest' | 'learner' | 'admin'
export type Permission = 'course:manage' | 'account:manage' | 'account:manage-all'

const permissions: Record<AppRole, readonly Permission[]> = {
  guest: [],
  learner: ['account:manage'],
  admin: ['account:manage', 'course:manage', 'account:manage-all'],
}

const pagePermissions: Partial<Record<Page, Permission>> = {
  onboarding: 'account:manage',
  review: 'account:manage',
  video: 'account:manage',
  courses: 'account:manage',
  learning: 'account:manage',
  courseAdmin: 'course:manage',
  accountAdmin: 'account:manage-all',
  profile: 'account:manage',
  settings: 'account:manage',
  security: 'account:manage',
}

export function getRole(user: AuthUser | null | undefined): AppRole {
  return user?.role === 'admin' ? 'admin' : user ? 'learner' : 'guest'
}

export function hasPermission(user: AuthUser | null | undefined, permission: Permission) {
  return permissions[getRole(user)].includes(permission)
}

export type PageAccess = 'allowed' | 'login-required' | 'forbidden'

export function getPageAccess(page: Page, user: AuthUser | null | undefined): PageAccess {
  const permission = pagePermissions[page]
  if (!permission) return 'allowed'
  if (!user) return 'login-required'
  return hasPermission(user, permission) ? 'allowed' : 'forbidden'
}
