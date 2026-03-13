import { Plan } from "./Plan";

export interface User {
  id: string;

  /* Auth */
  email:string;
  password_hash: string;
  QR_proof?: string;
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
  
  readonly:boolean;
  myPlan:Plan;
  registration_date: string;
}


export interface UserProfile {
  id: string;
  avatar: string;
  coverImg?: string;
  username: string;
  displayName ?: string;
  userInfo: UserInfo,
  type:  'fan'| 'artist'| 'admin' | 'creator';
  isVerified: boolean;
  isFollowing: boolean;
  myFollows: string[];
  myFans?:string[];
  myBlackList: string[];
  stats: {
    posts: number;
    fans: number;
    votes: number;
    stars: number;
  };
}

export interface UserInfo{
 /* Identity */
  first_name: string;
  last_name: string;
  gender: string;
  birthDate:Date;  
  age?: number; 

  /* Contact */
  email: string;
  phone: string;
  address: string;
  website: string;

  /* Personal */
  memberShip?: {date: string, plan: string};
  bio: string;
  school: {id: string, name:string};

}

export interface Artist {
  id: string;
  name: string;
  category: string;
  votes: number;
  imageUrl: string;
  rank?: number;
  isFavorite?: boolean;
}