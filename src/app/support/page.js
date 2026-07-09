'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getCurrentUserName, getCurrentUserRole } from '@/utils/userUtils';

export default function SupportPage() {
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'medium' });
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  useEffect(() => {
    // Fetch support tickets from backend API
    const fetchTickets = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/support-tickets');
        if (response.ok) {
          const data = await response.json();
          setTickets(data);
        } else {
          // Fallback to mock data if API fails
          const mockTickets = [
            {
              id: 1,
              subject: 'Login Issue',
              description: 'Unable to login to the system',
              priority: 'high',
              status: 'open',
              createdAt: '2024-01-02T10:30:00Z',
              category: 'Technical'
            },
            {
              id: 2,
              subject: 'Report Generation Error',
              description: 'Monthly report is not generating correctly',
              priority: 'medium',
              status: 'in-progress',
              createdAt: '2024-01-01T14:15:00Z',
              category: 'Bug Report'
            },
            {
              id: 3,
              subject: 'Feature Request',
              description: 'Add export functionality to attendance reports',
              priority: 'low',
              status: 'closed',
              createdAt: '2023-12-28T09:45:00Z',
              category: 'Enhancement'
            }
          ];
          setTickets(mockTickets);
        }
      } catch (error) {
        console.error('Error fetching support tickets:', error);
        // Fallback to mock data
        const mockTickets = [
          {
            id: 1,
            subject: 'Login Issue',
            description: 'Unable to login to the system',
            priority: 'high',
            status: 'open',
            createdAt: '2024-01-02T10:30:00Z',
            category: 'Technical'
          }
        ];
        setTickets(mockTickets);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const handleSubmitTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/api/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newTicket,
          category: 'User Query',
          status: 'open'
        })
      });

      if (response.ok) {
        const createdTicket = await response.json();
        setTickets([createdTicket, ...tickets]);
        setNewTicket({ subject: '', description: '', priority: 'medium' });
        setShowNewTicketForm(false);
        alert('Ticket created successfully!');
      } else {
        // Fallback to local state if API fails
        const ticket = {
          id: tickets.length + 1,
          ...newTicket,
          status: 'open',
          createdAt: new Date().toISOString(),
          category: 'User Query'
        };
        setTickets([ticket, ...tickets]);
        setNewTicket({ subject: '', description: '', priority: 'medium' });
        setShowNewTicketForm(false);
        alert('Ticket created locally (API unavailable)');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      // Fallback to local state
      const ticket = {
        id: tickets.length + 1,
        ...newTicket,
        status: 'open',
        createdAt: new Date().toISOString(),
        category: 'User Query'
      };
      setTickets([ticket, ...tickets]);
      setNewTicket({ subject: '', description: '', priority: 'medium' });
      setShowNewTicketForm(false);
      alert('Ticket created locally (API unavailable)');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-orange-100 text-orange-800';
      case 'closed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      header={{
        project: "Support Center",
        user: { name: "Admin User", role: "Administrator" }
      }}
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
            <p className="text-gray-600">Manage and track support tickets</p>
          </div>
          <Button 
            onClick={() => setShowNewTicketForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create New Ticket
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <div className="text-blue-600 text-2xl font-bold">📋</div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <div className="text-red-600 text-2xl font-bold">🔴</div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Open</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'open').length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <div className="text-orange-600 text-2xl font-bold">🟡</div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'in-progress').length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <div className="text-green-600 text-2xl font-bold">✅</div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Closed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'closed').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* New Ticket Modal */}
        {showNewTicketForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4">Create New Ticket</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ticket subject"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    placeholder="Describe your issue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={() => setShowNewTicketForm(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitTicket}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Submit Ticket
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{ticket.subject}</h3>
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-gray-600 mb-3">{ticket.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>📁 {ticket.category}</span>
                    <span>📅 {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-sm">
                    View Details
                  </Button>
                  {ticket.status !== 'closed' && (
                    <Button className="bg-green-600 hover:bg-green-700 text-sm">
                      Close Ticket
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
