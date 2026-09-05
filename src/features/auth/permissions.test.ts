import { describe, expect, it } from 'vitest'
import { getPageAccess, getRole, hasPermission } from './permissions'

const learner = {
  id: 'u1',
  name: 'Learner',
  email: 'learner@example.com',
  role: 'learner' as const,
  emailVerified: true,
  accountStatus: 'active' as const,
}
const admin = { ...learner, role: 'admin' as const }

describe('role-based UI access', () => {
  it('maps an anonymous visitor to guest and never grants admin access', () => {
    expect(getRole(null)).toBe('guest')
    expect(getPageAccess('courseAdmin', null)).toBe('login-required')
    expect(getPageAccess('onboarding', null)).toBe('login-required')
    expect(getPageAccess('vocabulary', null)).toBe('allowed')
    expect(getPageAccess('review', null)).toBe('login-required')
    expect(getPageAccess('video', null)).toBe('login-required')
    expect(getPageAccess('courses', null)).toBe('login-required')
  })

  it('keeps course management exclusive to admins', () => {
    expect(hasPermission(learner, 'course:manage')).toBe(false)
    expect(getPageAccess('courseAdmin', learner)).toBe('forbidden')
    expect(hasPermission(admin, 'course:manage')).toBe(true)
    expect(getPageAccess('courseAdmin', admin)).toBe('allowed')
    expect(getPageAccess('accountAdmin', learner)).toBe('forbidden')
    expect(getPageAccess('accountAdmin', admin)).toBe('allowed')
  })

  it('allows every signed-in learner to manage only their own account UI', () => {
    expect(getPageAccess('security', learner)).toBe('allowed')
    expect(getPageAccess('home', learner)).toBe('allowed')
    expect(getRole(undefined)).toBe('guest')
  })
})
