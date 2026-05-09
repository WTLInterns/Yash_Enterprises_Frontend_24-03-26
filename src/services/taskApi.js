const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const taskApi = {
  list: (params) => {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return apiRequest(`/api/tasks${queryString}`, { method: 'GET' });
  },
  create: (payload) => apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  update: (id, payload) => apiRequest(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  delete: (id) => apiRequest(`/api/tasks/${id}`, { method: 'DELETE' }),
};

export const taskEmployeesApi = {
  list: (params) => {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return apiRequest(`/api/task-employees${queryString}`, { method: 'GET' });
  },
};

export const taskCustomFieldsApi = {
  list: (params) => {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return apiRequest(`/api/task-custom-fields${queryString}`, { method: 'GET' });
  },
};
