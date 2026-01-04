import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    updatedAt?: string;
}

const UserManagement: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'MANAGER' as 'MANAGER' | 'ACCOUNTANT',
    });
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (!userStr || !token) {
            navigate('/login');
            return;
        }

        const user = JSON.parse(userStr);
        if (user.role !== 'ADMIN') {
            navigate('/dashboard');
            return;
        }

        fetchUsers();
    }, [navigate]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err: any) {
            if (err.response?.status === 403) {
                navigate('/dashboard');
            } else {
                setError(t('userManagement.failedToFetch'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/users`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowCreateForm(false);
            resetForm();
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.error || t('userManagement.failedToCreate'));
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            const token = localStorage.getItem('token');
            const updateData: any = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
            };
            if (formData.password) {
                updateData.password = formData.password;
            }

            await axios.patch(`${API_URL}/users/${editingUser.id}`, updateData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingUser(null);
            resetForm();
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update user');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this user?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.error || t('userManagement.failedToDelete'));
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            role: 'MANAGER',
        });
        setError('');
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role as 'MANAGER' | 'ACCOUNTANT',
        });
        setShowCreateForm(true);
    };

    const cancelForm = () => {
        setShowCreateForm(false);
        setEditingUser(null);
        resetForm();
    };

    const userStats = {
        total: users.length,
        admins: users.filter(u => u.role === 'ADMIN').length,
        managers: users.filter(u => u.role === 'MANAGER').length,
        accountants: users.filter(u => u.role === 'ACCOUNTANT').length,
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-50 p-8 text-center">{t('common.loading')}</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{t('userManagement.title')}</h1>
                    <p className="text-gray-600">Manage managers and accountants</p>
                </div>
                <div className="flex gap-4 items-center flex-shrink-0">
                    <LanguageSwitcher />
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    >
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingUser(null);
                            setShowCreateForm(true);
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                        + Create User
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{userStats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Admins</p>
                    <p className="text-2xl font-bold text-indigo-600">{userStats.admins}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Managers</p>
                    <p className="text-2xl font-bold text-green-600">{userStats.managers}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Accountants</p>
                    <p className="text-2xl font-bold text-blue-600">{userStats.accountants}</p>
                </div>
            </div>

            {/* Create/Edit Form */}
            {showCreateForm && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">
                        {editingUser ? t('userManagement.editUser') : t('userManagement.createUser')}
                    </h2>
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
                    <form onSubmit={editingUser ? handleUpdate : handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password {editingUser && '(leave empty to keep current)'}
                            </label>
                            <input
                                type="password"
                                required={!editingUser}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'MANAGER' | 'ACCOUNTANT' })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="MANAGER">Manager</option>
                                <option value="ACCOUNTANT">Accountant</option>
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                            >
                                {editingUser ? 'Update User' : 'Create User'}
                            </button>
                            <button
                                type="button"
                                onClick={cancelForm}
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">All Users</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' :
                                        user.role === 'MANAGER' ? 'bg-green-100 text-green-800' :
                                        'bg-blue-100 text-blue-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {user.role !== 'ADMIN' && (
                                        <>
                                            <button
                                                onClick={() => startEdit(user)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                    {user.role === 'ADMIN' && (
                                        <span className="text-gray-400 text-xs">Protected</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No users found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagement;












