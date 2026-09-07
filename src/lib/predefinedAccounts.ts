import { UserRole } from '../types/database';

export interface PredefinedAccount {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  company_id?: string;
  description: string;
}

export const PREDEFINED_ACCOUNTS: PredefinedAccount[] = [
  {
    name: 'Admin (Bahwan M&E)',
    email: 'admin@bahwanmge.com',
    password: 'bahwanmge',
    role: 'ADMIN',
    company_id: 'company-bahwan-mge',
    description: 'Company Administrator • Bahwan M&E',
  },
  {
    name: 'Rashid (Sales Rep)',
    email: 'rashid@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    company_id: 'company-bahwan-mge',
    description: 'Sales Representative • Bahwan M&E',
  },
  {
    name: 'Saud (Sales Rep)',
    email: 'saud@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    company_id: 'company-bahwan-mge',
    description: 'Sales Representative • Bahwan M&E',
  },
  {
    name: 'Joseph (Sales Rep)',
    email: 'joseph@bahwanmge.com',
    password: 'bahwanmge',
    role: 'SALESMAN',
    company_id: 'company-bahwan-mge',
    description: 'Sales Representative • Bahwan M&E',
  },
];
