import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Analytics: React.FC = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<any>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all_time');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [showCustomRange, setShowCustomRange] = useState<boolean>(false);
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
    const navigate = useNavigate();

    const fetchData = async (period?: string, startDate?: string, endDate?: string, departmentIds?: number[]) => {
        try {
            const token = localStorage.getItem('token');
            const params: any = {};
            if (period) {
                params.period = period;
            }
            if (startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }
            if (departmentIds && departmentIds.length > 0) {
                params.departmentIds = departmentIds.join(',');
            }
            
            const res = await axios.get(`${API_URL}/analytics`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setData(res.data);
        } catch (e) {
            console.error(e);
            // navigate('/dashboard'); // Fallback if unauthorized
        }
    };

    useEffect(() => {
        if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
            fetchData(undefined, customStartDate, customEndDate, selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined);
        } else if (selectedPeriod !== 'custom') {
            fetchData(selectedPeriod, undefined, undefined, selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined);
        }
    }, [selectedPeriod, customStartDate, customEndDate, selectedDepartmentIds]);

    const handlePeriodChange = (period: string) => {
        setSelectedPeriod(period);
        setShowCustomRange(period === 'custom');
        if (period !== 'custom') {
            setCustomStartDate('');
            setCustomEndDate('');
        }
    };

    const handleCustomRangeApply = () => {
        if (customStartDate && customEndDate) {
            fetchData(undefined, customStartDate, customEndDate, selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined);
        }
    };

    const handleDepartmentToggle = (departmentId: number) => {
        setSelectedDepartmentIds(prev => {
            if (prev.includes(departmentId)) {
                return prev.filter(id => id !== departmentId);
            } else {
                return [...prev, departmentId];
            }
        });
    };

    const handleSelectAllDepartments = () => {
        if (data?.departments) {
            if (selectedDepartmentIds.length === data.departments.length) {
                setSelectedDepartmentIds([]);
            } else {
                setSelectedDepartmentIds(data.departments.map((d: any) => d.id));
            }
        }
    };

    const handleExportExcel = async () => {
        try {
            const token = localStorage.getItem('token');
            const params: any = {};
            if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
                params.startDate = customStartDate;
                params.endDate = customEndDate;
            } else if (selectedPeriod !== 'custom') {
                params.period = selectedPeriod;
            }
            if (selectedDepartmentIds.length > 0) {
                params.departmentIds = selectedDepartmentIds.join(',');
            }
            
            const response = await axios.get(`${API_URL}/analytics/export/excel`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
                responseType: 'blob'
            });
            
            const periodSuffix = selectedPeriod !== 'all_time' ? `-${selectedPeriod}` : '';
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subscriptions-${new Date().toISOString().split('T')[0]}${periodSuffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert(t('analytics.failedToExportExcel'));
        }
    };

    const handleExportPDF = async () => {
        try {
            const token = localStorage.getItem('token');
            const params: any = {};
            if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
                params.startDate = customStartDate;
                params.endDate = customEndDate;
            } else if (selectedPeriod !== 'custom') {
                params.period = selectedPeriod;
            }
            if (selectedDepartmentIds.length > 0) {
                params.departmentIds = selectedDepartmentIds.join(',');
            }
            
            const response = await axios.get(`${API_URL}/analytics/export/pdf`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
                responseType: 'blob'
            });
            
            const periodSuffix = selectedPeriod !== 'all_time' ? `-${selectedPeriod}` : '';
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}${periodSuffix}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert(t('analytics.failedToExportPDF'));
        }
    };

    const getPeriodLabel = () => {
        switch (selectedPeriod) {
            case 'all_time': return t('analytics.allTime');
            case 'last_month': return t('analytics.lastMonth');
            case 'last_3_months': return t('analytics.last3Months');
            case 'last_6_months': return t('analytics.last6Months');
            case 'last_year': return t('analytics.lastYear');
            case 'custom': return customStartDate && customEndDate 
                ? `${customStartDate} to ${customEndDate}` 
                : t('analytics.customRange');
            default: return t('analytics.allTime');
        }
    };

    if (!data) return <div className="p-8 text-center text-gray-500">{t('analytics.loading')}</div>;

    const { kpi, charts } = data;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{t('analytics.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('analytics.period', { period: getPeriodLabel() })}
                        {selectedDepartmentIds.length > 0 && (
                            <span className="ml-2">
                                {t('analytics.departmentsSelected', { count: selectedDepartmentIds.length })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-3 items-center flex-shrink-0">
                    <LanguageSwitcher />
                    <button
                        onClick={handleExportExcel}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition flex items-center gap-2"
                    >
                        {t('analytics.exportExcel')}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition flex items-center gap-2"
                    >
                        {t('analytics.exportPDF')}
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
                    >
                        {t('analytics.backToDashboard')}
                    </button>
                </div>
            </div>

            {/* Time Period Selector */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-gray-700">{t('analytics.timePeriod')}</span>
                    <button
                        onClick={() => handlePeriodChange('all_time')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'all_time'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.allTime')}
                    </button>
                    <button
                        onClick={() => handlePeriodChange('last_month')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'last_month'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.lastMonth')}
                    </button>
                    <button
                        onClick={() => handlePeriodChange('last_3_months')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'last_3_months'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.last3Months')}
                    </button>
                    <button
                        onClick={() => handlePeriodChange('last_6_months')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'last_6_months'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.last6Months')}
                    </button>
                    <button
                        onClick={() => handlePeriodChange('last_year')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'last_year'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.lastYear')}
                    </button>
                    <button
                        onClick={() => handlePeriodChange('custom')}
                        className={`px-4 py-2 rounded text-sm transition ${
                            selectedPeriod === 'custom'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {t('analytics.customRange')}
                    </button>
                </div>
                
                {showCustomRange && (
                    <div className="mt-4 flex gap-3 items-center">
                        <div className="flex gap-2 items-center">
                            <label className="text-sm text-gray-700">{t('analytics.startDate')}</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>
                        <div className="flex gap-2 items-center">
                            <label className="text-sm text-gray-700">{t('analytics.endDate')}</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>
                        <button
                            onClick={handleCustomRangeApply}
                            disabled={!customStartDate || !customEndDate}
                            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            {t('analytics.apply')}
                        </button>
                    </div>
                )}
            </div>

            {/* Department Selector */}
            {data?.departments && (
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-gray-700">Departments:</span>
                        <button
                            onClick={handleSelectAllDepartments}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            {selectedDepartmentIds.length === data.departments.length 
                                ? 'Deselect All' 
                                : 'Select All'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {data.departments.map((dept: any) => (
                            <label
                                key={dept.id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedDepartmentIds.includes(dept.id)}
                                    onChange={() => handleDepartmentToggle(dept.id)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">{dept.name}</span>
                            </label>
                        ))}
                    </div>
                    {selectedDepartmentIds.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">No departments selected - showing all departments</p>
                    )}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
                    <p className="text-gray-500 text-sm font-medium">Monthly Spend (Est.)</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${kpi.totalMonthlySpend}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <p className="text-gray-500 text-sm font-medium">Active Subscriptions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpi.activeRequests}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
                    <p className="text-gray-500 text-sm font-medium">Pending Approvals</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpi.pendingRequests}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <p className="text-gray-500 text-sm font-medium">Total Requests</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpi.totalRequests}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Bar Chart: Spend by Department */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Spend by Department ($/mo)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.spendByDepartment}>
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis />
                                <Tooltip formatter={(value) => `$${value}`} />
                                <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart: Top Platforms */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Top Platforms (Spend)</h3>
                    <div className="h-80 flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={charts.spendByPlatform}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {charts.spendByPlatform.map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `$${value}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
