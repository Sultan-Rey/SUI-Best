export interface User {
  id: number;

  /* Identity */
  first_name: string;
  last_name: string;
  gender: string;
  birthDate?:Date;  
  age: number; 
  email: string;

  /* Auth */
  password_hash: string;
  QR_proof: string;
  password?: string;
  confirmPassword?: string;
  
  /* Role & statustudentProofs */
  user_type:
    | 'student'
    | 'fan'
    | 'subscriber'
    | 'artist'
    | 'admin'
    | 'creator';

  user_status: 
  |'university' 
  | 'student' 
  | 'other'; 

  status: 'active' | 'blocked' | 'pending';

  /* Meta */
  registration_date: string;
}
