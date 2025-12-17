import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Department {
    id: number;
    name: string;
}

interface Request {
    id: number;
    platformName: string;
    cost: number;
    status: string;
    createdAt: string;
    department?: { name: string; id?: number };
    requester?: { name: string; email: string };
}

const Dashboard: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
    const [selectedRequests, setSelectedRequests] = useState<number[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (!userStr || !token) {
            navigate('/login');
            return;
        }

        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);
        fetchRequests(token);
        
        // Fetch departments for ADMIN and ACCOUNTANT roles
        if (parsedUser.role === 'ADMIN' || parsedUser.role === 'ACCOUNTANT') {
            fetchDepartments(token);
        }
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

    const fetchDepartments = async (token: string) => {
        try {
            const res = await axios.get(`${API_URL}/departments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDepartments(res.data);
        } catch (error) {
            console.error('Failed to fetch departments', error);
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

    const handleUpdateStatus = async (id: number, status: string, currentStatus?: string) => {
        try {
            // Confirmation for status changes
            const statusMessages: Record<string, string> = {
                'PENDING': 'reset to PENDING',
                'APPROVED': 'approve',
                'REJECTED': 'reject',
                'ACTIVE': 'activate'
            };
            const action = statusMessages[status] || 'change status';
            const confirmMessage = currentStatus 
                ? `Are you sure you want to change this request from ${currentStatus} to ${status}?`
                : `Are you sure you want to ${action} this request?`;
            
            if (!window.confirm(confirmMessage)) {
                return; // User cancelled
            }

            let cost;
            let rejectionReason;

            if (status === 'APPROVED') {
                const costStr = prompt('Enter final cost (leave empty to keep current cost):');
                if (costStr && costStr.trim()) {
                    cost = parseFloat(costStr);
                    if (isNaN(cost)) {
                        alert('Invalid cost value');
                        return;
                    }
                }
            } else if (status === 'REJECTED') {
                rejectionReason = prompt('Enter rejection reason (required):');
                if (!rejectionReason || !rejectionReason.trim()) {
                    alert('Rejection reason is required');
                    return;
                }
            }

            await axios.patch(`${API_URL}/requests/${id}/status`,
                { status, cost, rejectionReason },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            // Refresh
            fetchRequests(localStorage.getItem('token')!);
            alert('Status updated successfully');
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Failed to update status';
            alert(errorMsg);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setDepartmentFilter('ALL');
    };

    const handleSelectRequest = (requestId: number, checked: boolean) => {
        if (checked) {
            setSelectedRequests([...selectedRequests, requestId]);
        } else {
            setSelectedRequests(selectedRequests.filter(id => id !== requestId));
        }
    };

    // Filter requests based on search and filter criteria
    const filteredRequests = useMemo(() => {
        return requests.filter((req) => {
            // Search filter - platform name (case-insensitive)
            if (searchQuery && !req.platformName.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }

            // Status filter
            if (statusFilter !== 'ALL' && req.status !== statusFilter) {
                return false;
            }

            // Department filter (only for ADMIN/ACCOUNTANT)
            if ((user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && departmentFilter !== 'ALL') {
                if (!req.department || req.department.id !== parseInt(departmentFilter)) {
                    return false;
                }
            }

            return true;
        });
    }, [requests, searchQuery, statusFilter, departmentFilter, user?.role]);

    // Get pending requests that can be selected (only for managers)
    const selectableRequests = useMemo(() => {
        if (user?.role !== 'MANAGER') return [];
        return filteredRequests.filter(req => req.status === 'PENDING');
    }, [filteredRequests, user?.role]);

    const handleSelectAll = () => {
        const selectableIds = selectableRequests.map(req => req.id);
        if (selectedRequests.length === selectableIds.length) {
            // Deselect all
            setSelectedRequests([]);
        } else {
            // Select all
            setSelectedRequests(selectableIds);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRequests.length === 0) return;

        const confirmMessage = `Are you sure you want to delete ${selectedRequests.length} selected request(s)? This action cannot be undone. Accountants will be notified.`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                `${API_URL}/requests/bulk-delete`,
                { requestIds: selectedRequests },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`Successfully deleted ${res.data.deletedCount} request(s)`);
            setSelectedRequests([]);
            // Refresh requests list
            fetchRequests(token || '');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to delete requests');
        }
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
                <div className="mb-4 flex gap-3 items-center flex-wrap">
                    <button
                        onClick={() => navigate('/requests/new')}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
                    >
                        + New Request
                    </button>
                    <button
                        onClick={() => navigate('/departments/budgets')}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                    >
                        💰 View Budgets
                    </button>
                    {selectableRequests.length > 0 && (
                        <>
                            <button
                                onClick={handleSelectAll}
                                className="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
                            >
                                {selectedRequests.length === selectableRequests.length ? 'Deselect All' : 'Select All'}
                            </button>
                            {selectedRequests.length > 0 && (
                                <>
                                    <span className="text-gray-700 font-medium">
                                        {selectedRequests.length} selected
                                    </span>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"
                                    >
                                        Delete Selected ({selectedRequests.length})
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && (
                <div className="mb-4 flex gap-3">
                    <button
                        onClick={() => navigate('/analytics')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
                    >
                        📊 View Analytics
                    </button>
                    <button
                        onClick={() => navigate('/departments/budgets')}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                    >
                        💰 View Budgets
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
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                            {user.role === 'ACCOUNTANT' || user.role === 'ADMIN' ? 'All Requests' : 'My Requests'}
                        </h3>
                        <button onClick={linkTelegram} className="text-sm text-indigo-600 hover:text-indigo-500">
                            Link Telegram
                        </button>
                    </div>
                    
                    {/* Search and Filter Section */}
                    <div className="flex flex-wrap gap-3 items-end">
                        {/* Search Input */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Search Platform</label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by platform name..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="min-w-[150px]">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="ALL">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="ACTIVE">Active</option>
                                <option value="EXPIRED">Expired</option>
                            </select>
                        </div>

                        {/* Department Filter (only for ADMIN/ACCOUNTANT) */}
                        {(user.role === 'ADMIN' || user.role === 'ACCOUNTANT') && (
                            <div className="min-w-[180px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="ALL">All Departments</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id.toString()}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Clear Filters Button */}
                        {(searchQuery || statusFilter !== 'ALL' || departmentFilter !== 'ALL') && (
                            <div>
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Results Count */}
                    <div className="mt-3 text-sm text-gray-600">
                        Showing {filteredRequests.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
                        {(searchQuery || statusFilter !== 'ALL' || departmentFilter !== 'ALL') && ' (filtered)'}
                    </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {user.role === 'MANAGER' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        checked={selectableRequests.length > 0 && selectedRequests.length === selectableRequests.length}
                                        onChange={handleSelectAll}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRequests.map((req) => (
                            <tr 
                                key={req.id} 
                                className={`hover:bg-gray-50 cursor-pointer ${selectedRequests.includes(req.id) ? 'bg-blue-50' : ''}`}
                                onClick={() => navigate(`/requests/${req.id}`)}
                            >
                                {user.role === 'MANAGER' && (
                                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        {req.status === 'PENDING' && (
                                            <input
                                                type="checkbox"
                                                checked={selectedRequests.includes(req.id)}
                                                onChange={(e) => handleSelectRequest(req.id, e.target.checked)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        )}
                                    </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{req.platformName}</div>
                                    {req.department && (
                                        <div className="text-xs text-gray-500">{req.department.name}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">${req.cost}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                    ${req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                        req.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                                        req.status === 'EXPIRED' ? 'bg-gray-100 text-gray-800' :
                                        'bg-yellow-100 text-yellow-800'}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</td>
                                {(user.role === 'ACCOUNTANT' || user.role === 'ADMIN') && (
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {req.status === 'PENDING' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'APPROVED', req.status); }} className="text-green-600 hover:text-green-900 mr-4">Approve</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'REJECTED', req.status); }} className="text-red-600 hover:text-red-900">Reject</button>
                                            </>
                                        )}
                                        {req.status === 'APPROVED' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'PENDING', req.status); }} className="text-yellow-600 hover:text-yellow-900 mr-4">Reset to Pending</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'REJECTED', req.status); }} className="text-red-600 hover:text-red-900">Reject</button>
                                            </>
                                        )}
                                        {req.status === 'REJECTED' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'PENDING', req.status); }} className="text-yellow-600 hover:text-yellow-900 mr-4">Reset to Pending</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(req.id, 'APPROVED', req.status); }} className="text-green-600 hover:text-green-900">Approve</button>
                                            </>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filteredRequests.length === 0 && requests.length > 0 && (
                            <tr>
                                <td colSpan={
                                    (user.role === 'ACCOUNTANT' || user.role === 'ADMIN') 
                                        ? 5 
                                        : user.role === 'MANAGER' 
                                        ? 5 
                                        : 4
                                } className="px-6 py-4 text-center text-gray-500">
                                    No requests match your filters. Try adjusting your search criteria.
                                </td>
                            </tr>
                        )}
                        {requests.length === 0 && (
                            <tr>
                                <td colSpan={
                                    (user.role === 'ACCOUNTANT' || user.role === 'ADMIN') 
                                        ? 5 
                                        : user.role === 'MANAGER' 
                                        ? 5 
                                        : 4
                                } className="px-6 py-4 text-center text-gray-500">No requests found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default Dashboard;
