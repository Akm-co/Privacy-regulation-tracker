import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - logout
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API service methods
export const regulationsApi = {
  getAll: (params) => api.get('/regulations', { params }),
  getById: (id) => api.get(`/regulations/${id}`),
  getUpdates: (id, params) => api.get(`/regulations/${id}/updates`, { params }),
  getEnforcements: (id, params) => api.get(`/regulations/${id}/enforcements`, { params }),
  compare: (ids) => api.get('/regulations/compare', { params: { ids: ids.join(',') } }),
  getByRegion: (regionCode) => api.get(`/regulations/by-region/${regionCode}`),
  getTags: () => api.get('/regulations/meta/tags')
};

export const updatesApi = {
  getAll: (params) => api.get('/updates', { params }),
  getById: (id) => api.get(`/updates/${id}`),
  getStats: () => api.get('/updates/stats/summary'),
  save: (id, data) => api.post(`/updates/${id}/save`, data),
  unsave: (id) => api.delete(`/updates/${id}/save`),
  getSaved: (params) => api.get('/updates/saved/list', { params }),
  getPersonalized: (params) => api.get('/updates/personalized/feed', { params }),
  getTrending: () => api.get('/updates/trending/list')
};

export const enforcementsApi = {
  getAll: (params) => api.get('/enforcements', { params }),
  getById: (id) => api.get(`/enforcements/${id}`),
  getStats: () => api.get('/enforcements/stats/summary'),
  getTop: (params) => api.get('/enforcements/top/list', { params }),
  getByAuthority: (authority, params) => api.get(`/enforcements/by-authority/${authority}`, { params }),
  getTrends: (params) => api.get('/enforcements/trends/data', { params }),
  search: (params) => api.get('/enforcements/search/query', { params })
};

export const regionsApi = {
  getAll: () => api.get('/regions'),
  getById: (code) => api.get(`/regions/${code}`),
  getRegulations: (code) => api.get(`/regions/${code}/regulations`),
  getUpdates: (code, params) => api.get(`/regions/${code}/updates`, { params }),
  getMapData: () => api.get('/regions/map/data'),
  getHeatmapData: (params) => api.get('/regions/heatmap/data', { params })
};

export const chatApi = {
  sendMessage: (data) => api.post('/chat', data),
  getHistory: (params) => api.get('/chat/history', { params }),
  getSession: (id) => api.get(`/chat/session/${id}`),
  updateSession: (id, data) => api.put(`/chat/session/${id}`, data),
  deleteSession: (id) => api.delete(`/chat/session/${id}`),
  quickQuestion: (question) => api.post('/chat/quick', { question }),
  getSuggestions: () => api.get('/chat/suggestions'),
  provideFeedback: (sessionId, messageId, data) =>
    api.post(`/chat/session/${sessionId}/feedback/${messageId}`, data)
};

export const checklistsApi = {
  getAll: (params) => api.get('/checklists', { params }),
  getById: (id) => api.get(`/checklists/${id}`),
  create: (data) => api.post('/checklists/generate', data),
  update: (id, data) => api.put(`/checklists/${id}`, data),
  delete: (id) => api.delete(`/checklists/${id}`),
  updateItem: (checklistId, itemId, data) => api.put(`/checklists/${checklistId}/items/${itemId}`, data),
  addItem: (checklistId, data) => api.post(`/checklists/${checklistId}/items`, data),
  removeItem: (checklistId, itemId) => api.delete(`/checklists/${checklistId}/items/${itemId}`),
  reorder: (checklistId, itemIds) => api.put(`/checklists/${checklistId}/reorder`, { itemIds }),
  getTemplates: () => api.get('/checklists/templates'),
  getSummary: () => api.get('/checklists/stats/summary')
};

export const reportsApi = {
  getAll: (params) => api.get('/reports', { params }),
  getById: (id) => api.get(`/reports/${id}`),
  generate: (data) => api.post('/reports/generate', data),
  getStatus: (id) => api.get(`/reports/${id}/status`),
  download: (id) => api.get(`/reports/${id}/download`),
  delete: (id) => api.delete(`/reports/${id}`),
  schedule: (id, data) => api.post(`/reports/${id}/schedule`, data),
  getSchedules: () => api.get('/reports/schedules/list'),
  cancelSchedule: (id) => api.delete(`/reports/${id}/schedule`),
  share: (id, data) => api.post(`/reports/${id}/share`, data),
  getShared: (token) => api.get(`/reports/shared/${token}`)
};

export const searchApi = {
  search: (params) => api.get('/search', { params }),
  suggest: (q) => api.get('/search/suggest', { params: { q } }),
  advanced: (data) => api.post('/search/advanced', data),
  saveSearch: (data) => api.post('/search/save', data),
  getSaved: () => api.get('/search/saved'),
  deleteSaved: (id) => api.delete(`/search/saved/${id}`),
  getFilters: () => api.get('/search/filters')
};

export const scrapingApi = {
  getStatus: () => api.get('/scraping/status'),
  getJobs: () => api.get('/scraping/jobs'),
  getStats: () => api.get('/scraping/stats'),
  triggerSource: (sourceId) => api.post(`/scraping/trigger/${sourceId}`),
  triggerTier: (tier) => api.post(`/scraping/trigger-tier/${tier}`),
  triggerAll: () => api.post('/scraping/trigger-all'),
  initialize: () => api.post('/scraping/initialize'),
  updateJob: (jobId, data) => api.patch(`/scraping/jobs/${jobId}`, data)
};

export const userApi = {
  getPreferences: () => api.get('/users/preferences'),
  updatePreferences: (data) => api.put('/users/preferences', data),
  getAlerts: () => api.get('/users/alerts'),
  createAlert: (data) => api.post('/users/alerts', data),
  updateAlert: (id, data) => api.put(`/users/alerts/${id}`, data),
  deleteAlert: (id) => api.delete(`/users/alerts/${id}`),
  getIntegrations: () => api.get('/users/integrations'),
  updateIntegration: (type, data) => api.put(`/users/integrations/${type}`, data),
  testIntegration: (type) => api.post(`/users/integrations/${type}/test`),
  generateApiKey: () => api.post('/users/api-key'),
  revokeApiKey: () => api.delete('/users/api-key'),
  getRecentlyViewed: () => api.get('/users/recently-viewed'),
  clearRecentlyViewed: () => api.delete('/users/recently-viewed'),
  exportData: () => api.get('/users/export'),
  deleteAccount: (data) => api.delete('/users/account', { data })
};
