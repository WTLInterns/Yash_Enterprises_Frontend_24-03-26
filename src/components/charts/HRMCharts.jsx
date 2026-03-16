'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  ACCOUNT: '#3B82F6',
  PPE: '#10B981', 
  PPO: '#8B5CF6',
  HCL: '#F97316'
};

const ATTENDANCE_COLORS = {
  PRESENT: '#10B981',
  ABSENT: '#EF4444',
  ON_LEAVE: '#F59E0B'
};

export const DepartmentDistributionChart = ({ data }) => {
  const chartData = Object.entries(data).map(([dept, stats]) => ({
    name: dept,
    value: stats.total,
    employees: stats.employee,
    tls: stats.tl,
    managers: stats.manager
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6B7280'} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const AttendanceChart = ({ data }) => {
  const chartData = Object.entries(data).map(([dept, stats]) => ({
    name: dept,
    present: stats.present,
    absent: stats.absent,
    onLeave: stats.onLeave
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="present" fill={ATTENDANCE_COLORS.PRESENT} name="Present" />
        <Bar dataKey="absent" fill={ATTENDANCE_COLORS.ABSENT} name="Absent" />
        <Bar dataKey="onLeave" fill={ATTENDANCE_COLORS.ON_LEAVE} name="On Leave" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const RoleDistributionChart = ({ data }) => {
  const roleData = [
    { name: 'Admins', value: data.totalAdmins },
    { name: 'Managers', value: data.totalManagers },
    { name: 'Team Leaders', value: data.totalTLs },
    { name: 'Employees', value: data.totalEmployees - data.totalAdmins - data.totalManagers - data.totalTLs }
  ];

  const ROLE_COLORS = {
    'Admins': '#EF4444',
    'Managers': '#8B5CF6',
    'Team Leaders': '#3B82F6',
    'Employees': '#10B981'
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={roleData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {roleData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={ROLE_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};
