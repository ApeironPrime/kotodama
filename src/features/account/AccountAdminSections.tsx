import type { UseQueryResult } from '@tanstack/react-query'
import { Button, Card, Modal } from '../../components/ui'
import { getApiErrorMessage } from '../../lib/apiClient'
import type { AuditEntry, ManagedUser, PendingAction, UserList } from './accountAdminTypes'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export function UserListSection({
  data,
  onAction,
  onPreviousPage,
  onNextPage,
}: {
  data: UserList
  onAction: (action: PendingAction) => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  return (
    <>
      <Card padding="none" className="account-admin-table-card">
        <div className="account-admin-summary">
          <strong>{data.total} tài khoản</strong>
          <span>
            Trang {data.page}/{data.totalPages}
          </span>
        </div>
        <div className="account-admin-table" role="table">
          <div className="account-admin-table__head" role="row">
            <span role="columnheader">Người dùng</span>
            <span role="columnheader">Vai trò</span>
            <span role="columnheader">Trạng thái</span>
            <span role="columnheader">Hoạt động gần nhất</span>
            <span role="columnheader">Thao tác</span>
          </div>
          {data.items.map((user) => (
            <UserRow key={user.id} user={user} onAction={onAction} />
          ))}
        </div>
        {data.items.length === 0 && <p className="account-admin-empty">Không tìm thấy tài khoản phù hợp.</p>}
      </Card>
      <div className="account-admin-pagination">
        <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={onPreviousPage}>
          <ArrowLeft aria-hidden="true" size={16} /> Trang trước
        </Button>
        <Button variant="secondary" size="sm" disabled={data.page >= data.totalPages} onClick={onNextPage}>
          Trang sau <ArrowRight aria-hidden="true" size={16} />
        </Button>
      </div>
    </>
  )
}

export function AuditLog({ audit }: { audit: UseQueryResult<{ items: AuditEntry[] }, Error> }) {
  const data = audit.data
  return (
    <Card padding="lg" className="account-admin-audit">
      <h2>Hoạt động quản trị gần đây</h2>
      {audit.isLoading ? (
        <p>Đang tải lịch sử…</p>
      ) : audit.isError ? (
        <Button variant="secondary" size="sm" onClick={() => void audit.refetch()}>
          Thử lại
        </Button>
      ) : data ? (
        <ul>
          {data.items.slice(0, 8).map((entry) => (
            <li key={entry.id}>
              <span>{formatAction(entry.action)}</span>
              <small>
                {formatDate(entry.at)}
                {entry.targetUserId ? ` · Tài khoản: ${entry.targetUserId.slice(0, 8)}` : ''}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

export function Confirmation({
  action,
  error,
  pending,
  onClose,
  onConfirm,
}: {
  action: PendingAction
  error: Error | null
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const label =
    action.type === 'status'
      ? action.value === 'suspended'
        ? 'khóa'
        : 'mở khóa'
      : action.value === 'admin'
        ? 'nâng quyền Admin cho'
        : 'hạ quyền của'
  return (
    <Modal title="Xác nhận thay đổi" onClose={onClose}>
      <div className="account-admin-confirm">
        <p>
          Bạn sắp {label} <strong>{action.user.email}</strong>.
        </p>
        <p>Thao tác sẽ được ghi vào lịch sử quản trị.</p>
        {error && (
          <p className="auth-card__error" role="alert">
            {getApiErrorMessage(error)}
          </p>
        )}
        <div>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {pending ? 'Đang lưu…' : 'Xác nhận'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function UserRow({ user, onAction }: { user: ManagedUser; onAction: (action: PendingAction) => void }) {
  return (
    <div className="account-admin-table__row" role="row">
      <div role="cell">
        <strong>{user.name}</strong>
        <small>
          {user.email} · {user.emailVerified ? 'Email đã xác minh' : 'Chưa xác minh'}
        </small>
      </div>
      <span role="cell" className={`account-admin-badge is-${user.role}`}>
        {user.role}
      </span>
      <span role="cell" className={`account-admin-badge is-${user.status}`}>
        {user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
      </span>
      <small role="cell">{user.lastActivityAt ? formatDate(user.lastActivityAt) : 'Chưa có'}</small>
      <div className="account-admin-actions" role="cell">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAction({ user, type: 'status', value: user.status === 'active' ? 'suspended' : 'active' })}
        >
          {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction({ user, type: 'role', value: user.role === 'admin' ? 'learner' : 'admin' })}
        >
          {user.role === 'admin' ? 'Hạ quyền' : 'Nâng Admin'}
        </Button>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  if (Number.isNaN(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
function formatAction(value: string) {
  return (
    (
      {
        'admin.user-suspended': 'Khóa tài khoản',
        'admin.user-active': 'Mở khóa tài khoản',
        'admin.user-role-changed': 'Thay đổi vai trò',
        'admin.bootstrap': 'Khởi tạo quản trị viên',
      } as Record<string, string>
    )[value] ?? value
  )
}
