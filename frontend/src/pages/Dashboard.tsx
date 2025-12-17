import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Request {
    id: number;
    platformName: string;
    cost: number;
    status: string;
    createdAt: string;
}

const Dashboard: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (!userStr || !token) {
            navigate('/login');
            return;
        }

        setUser(JSON.parse(userStr));
        fetchRequests(token);
    }, [navigate]);

    const fetchRequests = async (token: string) => {
        try {
            const res = await axios.get(`${API_URL}/requests`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
        }
    };

    const linkTelegram = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/telegram-link`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            window.open(res.data.link, '_blank');
        } catch (error) {
            alert('Failed to generate telegram link');
        }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            let cost;
            let rejectionReason;

            if (status === 'APPROVED') {
                const costStr = prompt('Enter final cost (leaves empty to keep current):');
                if (costStr) cost = parseFloat(costStr);
            } else if (status === 'REJECTED') {
                rejectionReason = prompt('Enter rejection reason:');
                if (!rejectionReason) return; // Cancelled
            }

            await axios.patch(`${API_URL}/requests/${id}/status`,
                { status, cost, rejectionReason },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            // Refresh
            fetchRequests(localStorage.getItem('token')!);
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (!user) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
                    <p className="text-gray-600">Role: {user.role}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                    Logout
                </button>
            </div>

            {user.role === 'MANAGER' && (
                <div className="mb-4">
                    <button
                        onClick={() => navigate('/requests/new')}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
                    >
                        + New Request
                    </button>
                </div>
            )}

            {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && (
                <div className="mb-4">
                    <button
                        onClick={() => navigate('/analytics')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
                    >
                        📊 View Analytics
                    </button>
                </div>
            )}

            {user.role === 'ADMIN' && (
                <div className="mb-4 flex gap-3">
                    <button
                        onClick={() => navigate('/users')}
                        className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700"
                    >
                        👥 User Management
                    </button>
                    <button
                        onClick={() => navigate('/departments')}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                    >
                        🏢 Department Management
                    </button>
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                        {user.role === 'ACCOUNTANT' || user.role === 'ADMIN' ? 'All Requests' : 'My Requests'}
                    </h3>
                    <button onClick={linkTelegram} className="text-sm text-indigo-600 hover:text-indigo-500">
                        Link Telegram
                    </button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map((req) => (
                            <tr key={req.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/requests/${req.id}`)}>
                                <td className="px-6 py-4 whitespace-nowrap">{req.platformName}</td>
                                <td className="px-6 py-4 whitespace-nowrap">${req.cost}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</td>
                                {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && (
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {req.status === 'PENDING' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'APPROVED'); }} className="text-green-600 hover:text-green-900 mr-4">Approve</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'REJECTED'); }} className="text-red-600 hover:text-red-900">Reject</button>
                                            </>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {requests.length === 0 && (
                            <tr>
                                <td colSpan={user.role === 'ACCOUNTANT' || user.role === 'ADMIN' ? 5 : 4} className="px-6 py-4 text-center text-gray-500">No requests found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default Dashboard;
