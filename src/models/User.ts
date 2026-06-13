import { LevelReward } from "./LevelReward";
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
  isVerified?: boolean;
  allowed_exclusive?:boolean;
  isFollowing?: boolean;
  myFollows: string[];
  myFans:string[];
  myBlackList: string[];
  /* Progress */
  level: number;
  xpPercent: number;
  level_rewards: LevelReward[],
  confidence_level: number,
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
  age: number; 

  /* Contact */
  email: string;
  phone?: string;
  address?: string;
  website?: string;

  /* Personal */
  memberShip?: {date: string, plan: string};
  activity?: string;
  bio?: string;
  school: {id: string, name:string, level:string};

}

// Interfaces pour TypeScript
export interface MarkedProfile {
  id: string;
  status: 'confirmed' | 'declined';
  userName: string;
  timestamp: number;
  updatedAt: string;
}

export interface MarkedStats {
  total: number;
  confirmed: number;
  declined: number;
  lastUpdated: number | null;
}
export interface School {
  id?: string;               // Identifiant unique facultatif à la création
  name: string;             // Nom de l'institution
  mail_address: string;     // Adresse email de l'école
  address: string;          // Adresse physique de l'école
  leader: string;           // Nom du directeur ou de la directrice
  access_code: string;      // Code d'accès généré automatiquement (Ex: SCH-LYC542)
  is_access_valid: boolean; // État de validité de l'accès
  created_at: string;       // Date de création / envoi de l'invitation (ISO string ou Date)
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