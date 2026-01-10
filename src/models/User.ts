import { Plan } from "./Plan";

export interface User {
  id: number | string;

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
    | 'fan'
    | 'artist'
    | 'admin'
    | 'creator';

  user_status: 
  |'university' 
  | 'student' 
  | 'other'; 

  status: 'active' | 'blocked' | 'pending';

  /* Meta */
  myFollow: string[]; 
  readonly:boolean;
  myPlan:Plan
  registration_date: string;
}


export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isVerified: boolean;
  isFollowing: boolean;
  plan?: string;
  bio: string;
  school: string;
  contact: string;
  memberSince: string;
  userType: 'fan' | 'artist' | 'creator' | 'admin';
  stats: {
    posts: number;
    fans: number;
    votes: number;
    stars: number;
  };
}