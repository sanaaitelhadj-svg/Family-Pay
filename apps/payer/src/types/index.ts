export interface Wallet {
  id: string;
  balance: number;
  currency: string;
}

export interface Envelope {
  id: string;
  label: string;
  category: string;
  balance: number;
  maxPerTransaction?: number;
  isActive: boolean;
}

export interface Beneficiary {
  userId: string;
  email: string;
  walletBalance: number;
  envelopes: Envelope[];
}

export interface FundRequest {
  id: string;
  amount: number;
  message?: string;
  status: string;
  createdAt: string;
  sender: { id: string; email: string; firstName: string; lastName: string };
}
