'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  UserCog,
  UserPlus,
  KeyRound,
  Shield,
  Check,
  AlertCircle,
  Edit2,
  X,
  Lock,
  Users,
  ShieldCheck,
} from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'sales_executive',
    pinCode: '12345',
  });

  const [editForm, setEditForm] = useState({
    fullName: '',
    role: 'sales_executive',
    pinCode: '12345',
    isActive: true,
  });

  const loadUsers = async () => {
    setTableLoading(true);
    const res = await apiRequest('/auth/users');
    if (res.success && res.data) setUsers(res.data);
    setTableLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/auth/users', {
      method: 'POST',
      body: JSON.stringify(addForm),
    });

    setLoading(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setAddForm({
        username: '',
        fullName: '',
        password: '',
        role: 'sales_executive',
        pinCode: '12345',
      });
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to create user account.');
    }
  };

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setEditForm({
      fullName: u.full_name,
      role: u.role,
      pinCode: u.pin_code || '12345',
      isActive: u.is_active,
    });
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/auth/users/${selectedUser.id}`, {
      method: 'PUT',
      body: JSON.stringify(editForm),
    });

    setLoading(false);

    if (res.success) {
      setIsEditModalOpen(false);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to update user.');
    }
  };

  const openResetPassword = (u: any) => {
    setSelectedUser(u);
    setNewPassword('');
    setErrorMsg(null);
    setIsPasswordModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/auth/users/${selectedUser.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });

    setLoading(false);

    if (res.success) {
      setIsPasswordModalOpen(false);
      alert('Password reset successfully.');
    } else {
      setErrorMsg(res.message || 'Failed to reset password.');
    }
  };

  const openResetPin = (u: any) => {
    setSelectedUser(u);
    setNewPin(u.pin_code || '12345');
    setErrorMsg(null);
    setIsPinModalOpen(true);
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/auth/users/${selectedUser.id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pinCode: newPin }),
    });

    setLoading(false);

    if (res.success) {
      setIsPinModalOpen(false);
      alert(`5-digit PIN for ${selectedUser.username} updated to ${newPin}.`);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to reset PIN.');
    }
  };

  const managerCount = users.filter((u) => u.role === 'manager').length;
  const cashierCount = users.filter((u) => u.role === 'sales_executive').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Staff & User Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure cashier employee accounts, role-based access permissions, and 5-digit POS authorization PINs.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setErrorMsg(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<UserPlus className="h-4 w-4" />}
        >
          Add Staff Member
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Staff Profiles"
          value={`${users.length} Users`}
          subValue="Registered Operators"
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />

        <MetricCard
          label="Store Managers"
          value={`${managerCount} Managers`}
          subValue="Full Privilege & PIN Approval"
          icon={<ShieldCheck className="h-5 w-5" />}
          variant="default"
        />

        <MetricCard
          label="Sales Executives / Cashiers"
          value={`${cashierCount} Cashiers`}
          subValue="POS Terminal Operators"
          icon={<UserCog className="h-5 w-5" />}
          variant="success"
        />
      </div>

      {/* Users DataTable */}
      <DataTable
        isLoading={tableLoading}
        data={users}
        keyExtractor={(u) => u.id}
        emptyMessage="No staff accounts found."
        columns={[
          {
            header: 'Staff Member',
            accessor: (u) => (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-sky-950/50 font-bold text-xs text-blue-700 dark:text-sky-400 border border-blue-200 dark:border-sky-900/50 uppercase">
                  {u.full_name?.slice(0, 2) || 'ST'}
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{u.full_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Created: {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: 'Username',
            accessor: (u) => (
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {u.username}
              </span>
            ),
          },
          {
            header: 'RBAC Role',
            accessor: (u) => (
              <Badge variant={u.role === 'manager' ? 'primary' : 'neutral'}>
                {u.role.replace('_', ' ').toUpperCase()}
              </Badge>
            ),
          },
          {
            header: '5-Digit PIN',
            align: 'center',
            accessor: (u) => (
              <span className="font-mono text-slate-500 font-bold">
                {u.pin_code ? '•••••' : 'None'}
              </span>
            ),
          },
          {
            header: 'Account Status',
            align: 'center',
            accessor: (u) => (
              <Badge variant={u.is_active ? 'success' : 'danger'}>
                {u.is_active ? 'ACTIVE' : 'DISABLED'}
              </Badge>
            ),
          },
          {
            header: 'Actions',
            align: 'right',
            accessor: (u) => (
              <div className="flex items-center justify-end gap-1.5">
                <IconButton
                  title="Edit Staff Account"
                  icon={<Edit2 className="h-4 w-4" />}
                  size="sm"
                  onClick={() => openEdit(u)}
                />
                <IconButton
                  title="Reset Password"
                  icon={<KeyRound className="h-4 w-4" />}
                  variant="secondary"
                  size="sm"
                  onClick={() => openResetPassword(u)}
                />
                <IconButton
                  title="Reset 5-Digit PIN"
                  icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
                  variant="secondary"
                  size="sm"
                  onClick={() => openResetPin(u)}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Create Staff Account</span>
          </div>
        }
        subtitle="Provision login credentials and quick POS unlocking PIN"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleCreateUser}>
              Create Account
            </Button>
          </>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name *"
            required
            value={addForm.fullName}
            onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
            placeholder="e.g. Tariq Hossen"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username (Login ID) *"
              required
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              placeholder="e.g. tariq"
            />

            <Input
              label="Account Password *"
              type="password"
              required
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="System Role *"
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
            >
              <option value="sales_executive">Sales Executive (POS Cashier)</option>
              <option value="manager">Store Manager (Full Privileges)</option>
            </Select>

            <Input
              label="5-Digit POS Unlock PIN *"
              type="password"
              maxLength={10}
              required
              value={addForm.pinCode}
              onChange={(e) => setAddForm({ ...addForm, pinCode: e.target.value })}
              className="font-mono text-center tracking-widest font-bold"
              placeholder="12345"
            />
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              <span>Edit Staff Member: {selectedUser.username}</span>
            </div>
          }
          subtitle="Update role assignment and POS PIN code"
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" isLoading={loading} onClick={handleUpdateUser}>
                Save Changes
              </Button>
            </>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateUser} className="space-y-4">
            <Input
              label="Full Name *"
              required
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="System Role *"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="sales_executive">Sales Executive (POS Cashier)</option>
                <option value="manager">Store Manager (Full Privileges)</option>
              </Select>

              <Input
                label="5-Digit POS Unlock PIN *"
                type="password"
                maxLength={10}
                required
                value={editForm.pinCode}
                onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value })}
                className="font-mono text-center tracking-widest font-bold"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-900 dark:text-white">Account is Active & Allowed to Sign In</span>
            </label>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {isPasswordModalOpen && selectedUser && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <span>Reset Password for {selectedUser.username}</span>
            </div>
          }
          subtitle="Set a new login password for this staff member"
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" isLoading={loading} onClick={handleResetPassword}>
                Update Password
              </Button>
            </>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              label="New Password *"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </form>
        </Modal>
      )}

      {/* Reset 5-Digit PIN Modal */}
      {isPinModalOpen && selectedUser && (
        <Modal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Reset 5-Digit PIN for {selectedUser.full_name}</span>
            </div>
          }
          subtitle={`Username: @${selectedUser.username} • Role: ${selectedUser.role.toUpperCase()}`}
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsPinModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" isLoading={loading} onClick={handleResetPin}>
                Update PIN
              </Button>
            </>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleResetPin} className="space-y-4">
            <Input
              label="New 5-Digit PIN *"
              type="text"
              required
              maxLength={10}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="12345"
              className="font-mono text-xl font-bold tracking-widest text-center"
            />

            <div className="flex gap-2">
              {['12345', '56789', '00000', '99999'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewPin(preset)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition"
                >
                  {preset}
                </button>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
