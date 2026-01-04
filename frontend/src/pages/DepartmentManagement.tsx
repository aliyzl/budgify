import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Department {
    id: number;
    name: string;
    monthlyBudget: number;
    currentManagerId: number | null;
    manager?: {
        id: number;
        name: string;
        email: string;
    } | null;
    managers?: {
        id: number;
        name: string;
        email: string;
    }[];
}

interface Manager {
    id: number;
    name: string;
    email: string;
}

const DepartmentManagement: React.FC = () => {
    const { t } = useTranslation();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        monthlyBudget: '',
        managerIds: [] as number[],
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

        fetchDepartments();
        fetchManagers();
    }, [navigate]);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/departments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDepartments(res.data);
        } catch (err: any) {
            if (err.response?.status === 403) {
                navigate('/dashboard');
            } else {
                setError('Failed to fetch departments');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchManagers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Filter only MANAGER role users
            const managerUsers = res.data.filter((user: any) => user.role === 'MANAGER');
            setManagers(managerUsers);
        } catch (err: any) {
            console.error('Failed to fetch managers:', err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload: any = {
                name: formData.name,
                monthlyBudget: parseFloat(formData.monthlyBudget as string),
            };
            if (formData.managerIds.length > 0) {
                payload.managerIds = formData.managerIds;
                payload.currentManagerId = formData.managerIds[0]; // Set first as primary
            }

            await axios.post(`${API_URL}/departments`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowCreateForm(false);
            resetForm();
            fetchDepartments();
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Failed to create department');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDepartment) return;

        try {
            const token = localStorage.getItem('token');
            const payload: any = {
                name: formData.name,
                monthlyBudget: parseFloat(formData.monthlyBudget as string),
            };
            if (formData.managerIds.length > 0) {
                payload.managerIds = formData.managerIds;
                payload.currentManagerId = formData.managerIds[0]; // Set first as primary
            } else {
                payload.managerIds = [];
                payload.currentManagerId = null;
            }

            await axios.patch(`${API_URL}/departments/${editingDepartment.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingDepartment(null);
            resetForm();
            fetchDepartments();
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Failed to update department');
        }
    };

    const handleDelete = async (id: number) => {
        const department = departments.find(d => d.id === id);
        if (!window.confirm(`Are you sure you want to delete "${department?.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/departments/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDepartments();
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Failed to delete department';
            if (err.response?.data?.requestCount) {
                alert(`${errorMsg}. This department has ${err.response.data.requestCount} request(s).`);
            } else {
                alert(errorMsg || t('departmentManagement.failedToDelete'));
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            monthlyBudget: '',
            managerIds: [],
        });
        setError('');
    };

    const startEdit = (department: Department) => {
        setEditingDepartment(department);
        const managerIds = department.managers?.map(m => m.id) || [];
        setFormData({
            name: department.name,
            monthlyBudget: department.monthlyBudget.toString(),
            managerIds: managerIds,
        });
        setShowCreateForm(true);
    };

    const handleManagerToggle = (managerId: number) => {
        setFormData(prev => {
            const currentIds = prev.managerIds;
            if (currentIds.includes(managerId)) {
                return { ...prev, managerIds: currentIds.filter(id => id !== managerId) };
            } else {
                return { ...prev, managerIds: [...currentIds, managerId] };
            }
        });
    };

    const cancelForm = () => {
        setShowCreateForm(false);
        setEditingDepartment(null);
        resetForm();
    };

    const totalBudget = departments.reduce((sum, dept) => sum + Number(dept.monthlyBudget), 0);

    if (loading) {
        return <div className="min-h-screen bg-gray-50 p-8 text-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
                    <p className="text-gray-600">Manage departments and monthly budgets</p>
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
                            setEditingDepartment(null);
                            setShowCreateForm(true);
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                        + Create Department
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Total Departments</p>
                    <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Total Monthly Budget</p>
                    <p className="text-2xl font-bold text-indigo-600">${totalBudget.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <p className="text-gray-500 text-sm">Average Budget</p>
                    <p className="text-2xl font-bold text-green-600">
                        ${departments.length > 0 ? (totalBudget / departments.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                    </p>
                </div>
            </div>

            {/* Create/Edit Form */}
            {showCreateForm && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">
                        {editingDepartment ? 'Edit Department' : 'Create New Department'}
                    </h2>
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
                    <form onSubmit={editingDepartment ? handleUpdate : handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g., IT Department"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget ($)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.monthlyBudget}
                                onChange={(e) => setFormData({ ...formData, monthlyBudget: e.target.value })}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="5000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Managers (Select multiple)</label>
                            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                                {managers.length === 0 ? (
                                    <p className="text-sm text-gray-500">No managers available. Create managers first.</p>
                                ) : (
                                    managers.map((manager) => (
                                        <label key={manager.id} className="flex items-center py-2 cursor-pointer hover:bg-gray-50 rounded px-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.managerIds.includes(manager.id)}
                                                onChange={() => handleManagerToggle(manager.id)}
                                                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            />
                                            <span className="text-sm text-gray-700">
                                                {manager.name} ({manager.email})
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                            {formData.managerIds.length > 0 && (
                                <p className="mt-2 text-sm text-gray-500">
                                    {formData.managerIds.length} manager(s) selected
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                            >
                                {editingDepartment ? 'Update Department' : 'Create Department'}
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

            {/* Departments Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">All Departments</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Budget</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {departments.map((department) => (
                            <tr key={department.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium">{department.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-gray-900 font-semibold">${Number(department.monthlyBudget).toLocaleString()}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {department.managers && department.managers.length > 0 ? (
                                        <div className="space-y-1">
                                            {department.managers.map((manager) => (
                                                <div key={manager.id} className="text-sm">
                                                    <span className="font-medium text-gray-900">{manager.name}</span>
                                                    <span className="text-gray-500 ml-2">({manager.email})</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-sm">No managers assigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => startEdit(department)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(department.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {departments.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No departments found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DepartmentManagement;

