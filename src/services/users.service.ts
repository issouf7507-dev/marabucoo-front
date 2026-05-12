import { api } from './api';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COO' | 'VIEWER';
  active: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'COO' | 'VIEWER';
}

export const usersService = {
  getAll: () => api.get<ApiUser[]>('/users'),
  create: (data: CreateUserInput) => api.post<ApiUser>('/users', data),
  update: (id: string, data: Partial<{ name: string; role: string; active: boolean }>) =>
    api.put<ApiUser>(`/users/${id}`, data),
  remove: (id: string) => api.delete<void>(`/users/${id}`),
};
