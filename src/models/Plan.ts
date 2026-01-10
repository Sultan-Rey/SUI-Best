export interface Plan {
  id: string;
  name: string;
  price: number;  // Changé de string à number
  period: string;
  duration: number;
  icon?: string;
  startDate: string;
  endDate: string;
 status: 'active' | 'expired' | 'pending';
  features: string[];
  popular?: boolean;
  color?: string; 
  isPopular?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}