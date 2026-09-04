import { UserRole } from '../types/database';

export interface PredefinedAccount {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  description: string;
}

export const PREDEFINED_ACCOUNTS: PredefinedAccount[] = [
  {
    name: 'Admin',
    email: 'admin@bahwanmge.com',
    password: 'bahwanmge',
    role: 'ADMIN',
    description: 'System Administrator • Full Lead & Team Visibility',
  },
  {
    name: 'Rashid',
    email: 'rashid@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    description: 'Sales Representative • Assigned Pipeline',
  },
  {
    name: 'Saud',
    email: 'saud@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    description: 'Sales Representative • Assigned Pipeline',
  },
  {
    name: 'Joseph',
    email: 'joseph@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    description: 'Sales Representative • Assigned Pipeline',
  },
];
