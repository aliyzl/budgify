import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ActiveRequest {
    id: number;
    platformName: string;
    cost: number;
    currency: string;
    status: string;
    startDate: string | null;
    renewalDate: string | null;
    paymentFrequency: string;
    createdAt: string;
}

interface DepartmentBudget {
    id: number;
    name: string;
    totalBudget: number;
    spentBudget: number;
    remainingBudget: number;
    budgetUsagePercentage: number;
    activeRequests: ActiveRequest[];
}

const DepartmentBudgets: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [departments, setDepartments] = useState<DepartmentBudget[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<string>('current-month');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const navigate = useNavigate();

    const getDateRange = () => {
        const now = new Date();
        let start: Date;
        let end: Date;

        switch (dateRange) {
            case 'current-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'previous-month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            case 'custom':
                if (!customStartDate || !customEndDate) {
                    return null;
                }
                start = new Date(customStartDate);
                end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                return null;
        }

        return { start, end };
    };

    const fetchBudgets = useCallback(async (token: string) => {
        try {
            setLoading(true);
            const dateRangeObj = getDateRange();
            
            let url = `${API_URL}/departments/budgets`;
            if (dateRangeObj) {
                url += `?startDate=${dateRangeObj.start.toISOString()}&endDate=${dateRangeObj.end.toISOString()}`;
            }

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDepartments(res.data.departments || []);
        } catch (error: any) {
            console.error('Failed to fetch budgets', error);
            if (error.response?.status === 403) {
                navigate('/dashboard');
            } else {
                alert('Failed to fetch budget information');
            }
        } finally {
            setLoading(false);
        }
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (!userStr || !token) {
            navigate('/login');
            return;
        }

        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);

        // Only managers, admins, and accountants can access this page
        if (parsedUser.role !== 'MANAGER' && parsedUser.role !== 'ADMIN' && parsedUser.role !== 'ACCOUNTANT') {
            navigate('/dashboard');
            return;
        }

        // Don't fetch if custom range is selected but dates are not set
        if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
            setLoading(false);
            return;
        }

        fetchBudgets(token);
    }, [navigate, dateRange, customStartDate, customEndDate, fetchBudgets]);

    const handleDateRangeChange = (newRange: string) => {
        setDateRange(newRange);
    };

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const handleExportExcel = async () => {
        try {
            const token = localStorage.getItem('token');
            const dateRangeObj = getDateRange();
            
            let url = `${API_URL}/departments/budgets/export/excel`;
            if (dateRangeObj) {
                url += `?startDate=${dateRangeObj.start.toISOString()}&endDate=${dateRangeObj.end.toISOString()}`;
            }

            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            const url_blob = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url_blob;
            
            // Generate filename
            const today = new Date().toISOString().split('T')[0];
            let filename = `department-budgets-${today}.xlsx`;
            if (dateRangeObj) {
                const startStr = dateRangeObj.start.toISOString().split('T')[0];
                const endStr = dateRangeObj.end.toISOString().split('T')[0];
                filename = `department-budgets-${startStr}-to-${endStr}.xlsx`;
            }
            
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            console.error('Failed to export Excel:', error);
            if (error.response?.status === 403) {
                alert('You do not have permission to export budgets');
            } else {
                alert('Failed to export Excel file');
            }
        }
    };

    const handleExportPDF = async () => {
        try {
            const token = localStorage.getItem('token');
            const dateRangeObj = getDateRange();
            
            let url = `${API_URL}/departments/budgets/export/pdf`;
            if (dateRangeObj) {
                url += `?startDate=${dateRangeObj.start.toISOString()}&endDate=${dateRangeObj.end.toISOString()}`;
            }

            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            const url_blob = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url_blob;
            
            // Generate filename
            const today = new Date().toISOString().split('T')[0];
            let filename = `department-budgets-${today}.pdf`;
            if (dateRangeObj) {
                const startStr = dateRangeObj.start.toISOString().split('T')[0];
                const endStr = dateRangeObj.end.toISOString().split('T')[0];
                filename = `department-budgets-${startStr}-to-${endStr}.pdf`;
            }
            
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            console.error('Failed to export PDF:', error);
            if (error.response?.status === 403) {
                alert('You do not have permission to export budgets');
            } else {
                alert('Failed to export PDF file');
            }
        }
    };

    if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN' && user.role !== 'ACCOUNTANT')) {
        return <div className="min-h-screen bg-gray-100 p-8">Loading...</div>;
    }

    if (loading) {
        return <div className="min-h-screen bg-gray-100 p-8 text-center">Loading budget information...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Department Budgets</h1>
                    <p className="text-gray-600">
                        {user.role === 'MANAGER' 
                            ? 'View budget information for your departments' 
                            : 'View budget information for all departments'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        📊 Export Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={loading}
                        className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        📄 Export PDF
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                        <select
                            value={dateRange}
                            onChange={(e) => handleDateRangeChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="current-month">Current Month</option>
                            <option value="previous-month">Previous Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {dateRange === 'custom' && (
                        <>
                            <div className="min-w-[180px]">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="min-w-[180px]">
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Department Budget Cards */}
            {departments.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No departments found or you don't have access to any departments.
                </div>
            ) : (
                <div className="space-y-6">
                    {departments.map((dept) => (
                        <div key={dept.id} className="bg-white rounded-lg shadow overflow-hidden">
                            {/* Budget Summary Card */}
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">{dept.name}</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Total Budget</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {formatCurrency(dept.totalBudget)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Spent Budget</p>
                                        <p className="text-2xl font-bold text-red-600">
                                            {formatCurrency(dept.spentBudget)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {dept.budgetUsagePercentage.toFixed(1)}% used
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Remaining Budget</p>
                                        <p className={`text-2xl font-bold ${dept.remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(dept.remainingBudget)}
                                        </p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4">
                                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Budget Usage</span>
                                        <span>{dept.budgetUsagePercentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                            className={`h-3 rounded-full ${
                                                dept.budgetUsagePercentage >= 100
                                                    ? 'bg-red-600'
                                                    : dept.budgetUsagePercentage >= 80
                                                    ? 'bg-yellow-500'
                                                    : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(dept.budgetUsagePercentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Accounts Table */}
                            <div className="p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">
                                    Active Accounts ({dept.activeRequests.length})
                                </h3>
                                
                                {dept.activeRequests.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No active accounts in the selected date range.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Platform
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Cost
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Frequency
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Start Date
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Renewal Date
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {dept.activeRequests.map((request) => (
                                                    <tr key={request.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {request.platformName}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                            {formatCurrency(request.cost, request.currency)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {request.paymentFrequency}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {formatDate(request.startDate || request.createdAt)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {formatDate(request.renewalDate)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span
                                                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                    request.status === 'APPROVED'
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : request.status === 'REJECTED'
                                                                        ? 'bg-red-100 text-red-800'
                                                                        : request.status === 'ACTIVE'
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : 'bg-yellow-100 text-yellow-800'
                                                                }`}
                                                            >
                                                                {request.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DepartmentBudgets;

