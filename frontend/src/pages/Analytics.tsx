import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Analytics: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/analytics`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (e) {
                console.error(e);
                // navigate('/dashboard'); // Fallback if unauthorized
            }
        };
        fetchData();
    }, [navigate]);

    if (!data) return <div className="p-8 text-center text-gray-500">Loading Analytics...</div>;

    const { kpi, charts } = data;

    const handleExportExcel = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/analytics/export/excel`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subscriptions-${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('Failed to export Excel');
        }
    };

    const handleExportPDF = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/analytics/export/pdf`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('Failed to export PDF');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition flex items-center gap-2"
                    >
                        📊 Export Excel
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition flex items-center gap-2"
                    >
                        📄 Export PDF
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>

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
