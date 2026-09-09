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
  Eye,
  EyeOff,
  Info,
  CheckCircle2,
  Sparkles,
  Award,
  UserX,
  UserCheck,
} from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showPromotePassword, setShowPromotePassword] = useState(false);

  // Promote form state
  const [promoteForm, setPromoteForm] = useState({
    username: '',
    password: '',
  });

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
    password: '',
    pinCode: '',
  });

  const loadUsers = async () => {
    setTableLoading(true);
    const res = await apiRequest('/auth/users');
    if (res.success && res.data) setUsers(res.data);
    setTableLoading(false);
  };

  const generateRandomPin = () => {
    const pin = Math.floor(10000 + Math.random() * 90000).toString();
    setAddForm((prev) => ({ ...prev, pinCode: pin }));
  };

  const openAddModal = () => {
    setErrorMsg(null);
    setShowPassword(false);
    const initialPin = Math.floor(10000 + Math.random() * 90000).toString();
    setAddForm({
      username: '',
      fullName: '',
      password: '',
      role: 'sales_executive',
      pinCode: initialPin,
    });
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    loadUsers();
    const loadCurrentUser = async () => {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data?.user) setCurrentUser(res.data.user);
    };
    loadCurrentUser();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const trimmedFullName = addForm.fullName.trim();
    const trimmedUsername = addForm.username.trim();
    const trimmedPassword = addForm.password.trim();
    const trimmedPin = addForm.pinCode.trim();

    if (!trimmedFullName || trimmedFullName.length < 2) {
      setErrorMsg('Full name must be at least 2 characters.');
      setLoading(false);
      return;
    }

    // Role-specific credential validation
    if (addForm.role === 'manager') {
      if (!trimmedUsername || trimmedUsername.length < 3) {
        setErrorMsg('Username must be at least 3 characters.');
        setLoading(false);
        return;
      }
      if (!trimmedPassword || trimmedPassword.length < 6) {
        setErrorMsg('Store Manager requires an account password of at least 6 characters.');
        setLoading(false);
        return;
      }
      if (!trimmedPin || trimmedPin.length < 5 || trimmedPin.length > 10) {
        setErrorMsg('Store Manager requires a 5 to 10-digit authorization PIN.');
        setLoading(false);
        return;
      }
    } else {
      // Sales executive requires only PIN
      if (!trimmedPin || trimmedPin.length < 5 || trimmedPin.length > 10) {
        setErrorMsg('Sales Executive requires a 5 to 10-digit POS unlock PIN.');
        setLoading(false);
        return;
      }
    }

    const payload: any = {
      role: addForm.role,
      fullName: trimmedFullName,
      pinCode: trimmedPin,
    };
    if (addForm.role === 'manager') {
      payload.username = trimmedUsername;
      payload.password = trimmedPassword;
    }

    const res = await apiRequest('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload),
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
      setErrorMsg(res.message || 'Failed to create staff account.');
    }
  };

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setEditForm({
      password: '',
      pinCode: '',
    });
    setShowEditPassword(false);
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const isMgr = selectedUser.role === 'manager';
    const trimmedPin = editForm.pinCode.trim();
    const trimmedPassword = editForm.password.trim();

    if (!isMgr) {
      if (!trimmedPin || trimmedPin.length < 5 || trimmedPin.length > 10) {
        setErrorMsg('POS unlock PIN must be 5 to 10 digits.');
        setLoading(false);
        return;
      }
    } else {
      if (!trimmedPin && !trimmedPassword) {
        setErrorMsg('Please provide a new password or a new PIN to update.');
        setLoading(false);
        return;
      }
      if (trimmedPassword && trimmedPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      if (trimmedPin && (trimmedPin.length < 5 || trimmedPin.length > 10)) {
        setErrorMsg('PIN must be 5 to 10 digits.');
        setLoading(false);
        return;
      }
    }

    const payload: any = {};
    if (trimmedPin) payload.pinCode = trimmedPin;
    if (isMgr && trimmedPassword) payload.password = trimmedPassword;

    const res = await apiRequest(`/auth/users/${selectedUser.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (res.success) {
      setIsEditModalOpen(false);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to update credentials.');
    }
  };

  const openPromote = (u: any) => {
    setSelectedUser(u);
    setPromoteForm({
      username: '',
      password: '',
    });
    setShowPromotePassword(false);
    setErrorMsg(null);
    setIsPromoteModalOpen(true);
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const trimmedUsername = promoteForm.username.trim().toLowerCase();
    const trimmedPassword = promoteForm.password.trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      setErrorMsg('Store Manager username must be at least 3 characters.');
      setLoading(false);
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setErrorMsg('Store Manager account password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    const payload: any = {
      username: trimmedUsername,
      password: trimmedPassword,
    };

    const res = await apiRequest(`/auth/users/${selectedUser.id}/promote`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (res.success) {
      setIsPromoteModalOpen(false);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to promote staff member.');
    }
  };

  const openRevoke = (u: any) => {
    setSelectedUser(u);
    setErrorMsg(null);
    setIsRevokeModalOpen(true);
  };

  const handleRevoke = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/auth/users/${selectedUser.id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    setLoading(false);

    if (res.success) {
      setIsRevokeModalOpen(false);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to revoke user access.');
    }
  };

  const handleRestore = async (u: any) => {
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/auth/users/${u.id}/restore`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    setLoading(false);

    if (res.success) {
      loadUsers();
    } else {
      alert(res.message || 'Failed to restore user access.');
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
          onClick={openAddModal}
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
              u.username ? (
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {u.username}
                </span>
              ) : (
                <span className="text-slate-400 font-mono text-xs italic">PIN Only</span>
              )
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
                {u.is_active ? 'ACTIVE' : 'REVOKED'}
              </Badge>
            ),
          },
          {
            header: 'Actions',
            align: 'right',
            accessor: (u) => {
              const canRevokeOrRestore =
                currentUser &&
                currentUser.id !== u.id &&
                u.id !== 1 &&
                currentUser.created_by !== u.id;

              return (
                <div className="flex items-center justify-end gap-1.5">
                  <IconButton
                    title={u.role === 'manager' ? 'Update Password & PIN' : 'Update POS PIN'}
                    icon={<KeyRound className="h-4 w-4 text-amber-500" />}
                    size="sm"
                    onClick={() => openEdit(u)}
                  />
                  {u.role === 'sales_executive' && u.is_active && (
                    <IconButton
                      title="Promote to Store Manager"
                      icon={<Award className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                      variant="secondary"
                      size="sm"
                      onClick={() => openPromote(u)}
                    />
                  )}
                  {canRevokeOrRestore && (
                    u.is_active ? (
                      <IconButton
                        title="Revoke System Access"
                        icon={<UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                        variant="secondary"
                        size="sm"
                        onClick={() => openRevoke(u)}
                      />
                    ) : (
                      <IconButton
                        title="Restore System Access"
                        icon={<UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestore(u)}
                      />
                    )
                  )}
                </div>
              );
            },
          },
        ]}
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        icon={<UserPlus className="h-5 w-5 text-blue-600 dark:text-sky-400" />}
        title="Create Staff Account"
        subtitle="Set credentials and POS unlock PIN"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button variant="secondary" size="md" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={loading}
              onClick={handleCreateUser}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Create Account
            </Button>
          </div>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-4">
          {/* Role Tab: Just Icon, Title, and Subtitle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Staff Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAddForm({ ...addForm, role: 'sales_executive' })}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  addForm.role === 'sales_executive'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-sky-950/40 dark:border-sky-500 ring-2 ring-blue-500/20 dark:ring-sky-400/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    addForm.role === 'sales_executive'
                      ? 'bg-blue-600 text-white dark:bg-sky-500 dark:text-slate-950'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <UserCog className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Sales Executive</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">POS Cashier</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAddForm({ ...addForm, role: 'manager' })}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  addForm.role === 'manager'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20 dark:ring-indigo-400/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    addForm.role === 'manager'
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">Store Manager</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Full Access</div>
                </div>
              </button>
            </div>
          </div>

          {/* Form Fields: Role-dependent */}
          {addForm.role === 'sales_executive' ? (
            <>
              {/* Sales Executive: Full Name */}
              <Input
                label="Full Name"
                required
                value={addForm.fullName}
                onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                placeholder="e.g. Tariq Hossen"
              />

              {/* Sales Executive: 5-Digit POS Unlock PIN */}
              <div className="w-full space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  5-Digit POS Unlock PIN <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                  <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <input
                    type="text"
                    maxLength={10}
                    required
                    value={addForm.pinCode}
                    onChange={(e) => setAddForm({ ...addForm, pinCode: e.target.value.replace(/\D/g, '') })}
                    placeholder="12345"
                    className="w-full bg-transparent px-2.5 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-center font-bold"
                  />
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      onClick={generateRandomPin}
                      className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                      title="Generate random PIN"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Store Manager: Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Full Name"
                  required
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  placeholder="e.g. Tariq Hossen"
                />

                <Input
                  label="Username (Login ID)"
                  required
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  placeholder="e.g. tariq"
                />
              </div>

              {/* Store Manager: Password & PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Account Password */}
                <div className="w-full space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Account Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                    <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full bg-transparent px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* 5-Digit POS Unlock PIN */}
                <div className="w-full space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    5-Digit POS Unlock PIN <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                    <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <input
                      type="text"
                      maxLength={10}
                      required
                      value={addForm.pinCode}
                      onChange={(e) => setAddForm({ ...addForm, pinCode: e.target.value.replace(/\D/g, '') })}
                      placeholder="12345"
                      className="w-full bg-transparent px-2.5 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-center font-bold"
                    />
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={generateRandomPin}
                        className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                        title="Generate random PIN"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Unified Credentials Update Modal (Password & PIN for Manager, PIN for Sales Executive) */}
      {isEditModalOpen && selectedUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          icon={<KeyRound className="h-5 w-5 text-amber-500" />}
          title={selectedUser.role === 'manager' ? 'Update Credentials' : 'Update POS PIN'}
          subtitle={
            selectedUser.role === 'manager'
              ? 'Set new password and POS unlock PIN'
              : 'Set 5-digit POS unlock PIN'
          }
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button variant="secondary" size="md" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" isLoading={loading} onClick={handleUpdateUser}>
                Save Changes
              </Button>
            </div>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdateUser} className="space-y-4">
            {/* Concise Hint Message */}
            {selectedUser.role === 'manager' && (
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                Leave blank any credential you do not wish to change.
              </div>
            )}

            {/* Manager Password Field */}
            {selectedUser.role === 'manager' && (
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    New Account Password
                  </label>
                  <span className="text-[10px] text-slate-400">Min 6 chars</span>
                </div>
                <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                  <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full bg-transparent px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showEditPassword ? 'Hide password' : 'Show password'}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 5-Digit POS PIN Field */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {selectedUser.role === 'manager' ? 'New 5-Digit POS PIN' : '5-Digit POS PIN *'}
                </label>
                <span className="text-[10px] text-slate-400">
                  {selectedUser.role === 'manager' ? 'Optional' : 'Required'}
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <input
                  type="text"
                  maxLength={10}
                  required={selectedUser.role !== 'manager'}
                  value={editForm.pinCode}
                  onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value.replace(/\D/g, '') })}
                  placeholder={selectedUser.role === 'manager' ? 'Leave blank to keep current' : 'Enter 5-digit PIN'}
                  className="w-full bg-transparent px-2.5 py-2 text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-center font-bold"
                />
                <div className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pin = Math.floor(10000 + Math.random() * 90000).toString();
                      setEditForm((prev) => ({ ...prev, pinCode: pin }));
                    }}
                    className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                    title="Generate random PIN"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Promote to Store Manager Modal */}
      {isPromoteModalOpen && selectedUser && (
        <Modal
          isOpen={isPromoteModalOpen}
          onClose={() => setIsPromoteModalOpen(false)}
          icon={<Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          title="Promote to Store Manager"
          subtitle={`Elevate ${selectedUser.full_name} to Store Manager`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button variant="secondary" size="md" onClick={() => setIsPromoteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={loading}
                onClick={handlePromote}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Confirm Promotion
              </Button>
            </div>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handlePromote} className="space-y-4">
            {/* Informative alert callout */}
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 text-xs text-indigo-800 dark:text-indigo-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <span className="leading-relaxed">
                Promoting a sales executive to Store Manager will grant access to everything. From dashboard to sales profit and inventory, everything can be accessed in this system.
              </span>
            </div>

            {/* Manager Username & Password (PIN/OTP not needed as already provided) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Manager Username (Login ID)"
                required
                value={promoteForm.username}
                onChange={(e) => setPromoteForm({ ...promoteForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                placeholder="e.g. karim_mgr"
              />

              <div className="w-full space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20 transition-all">
                  <div className="pl-3.5 pr-1 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPromotePassword ? 'text' : 'password'}
                    required
                    value={promoteForm.password}
                    onChange={(e) => setPromoteForm({ ...promoteForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full bg-transparent px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPromotePassword(!showPromotePassword)}
                    className="pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showPromotePassword ? 'Hide password' : 'Show password'}
                  >
                    {showPromotePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Revoke User Access Confirmation Modal (Wider modal & concise subtitle) */}
      {isRevokeModalOpen && selectedUser && (
        <Modal
          isOpen={isRevokeModalOpen}
          onClose={() => setIsRevokeModalOpen(false)}
          icon={<UserX className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          title="Revoke System Access"
          subtitle="Immediately terminates access"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button variant="secondary" size="md" onClick={() => setIsRevokeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                isLoading={loading}
                onClick={handleRevoke}
                leftIcon={<UserX className="h-4 w-4" />}
              >
                Revoke Access Now
              </Button>
            </div>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 p-4 text-xs text-rose-900 dark:text-rose-200 space-y-2.5">
              <p className="font-semibold text-rose-950 dark:text-rose-100 text-sm">
                Revoke all system privileges for <span className="underline font-bold">{selectedUser.full_name}</span>?
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-rose-800 dark:text-rose-300">
                <li>Immediately logged out and terminate access</li>
                <li>Password and 5-digit PIN logins will be denied.</li>
                <li>Any open cashier shift will be closed automatically.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
