import { Challenge } from './Challenge';
import { Content } from './Content';
import { UserProfile } from './User'; // À adapter selon le nom de votre modèle de profil utilisateur

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface ParticipantRequest {
  id?: string;
  challenge_id: string;
  user_id: string;
  content_id: string;
  status: RequestStatus;
  created_at?: string;
  updated_at?: string;

  // Relations optionnelles résolues par l'API pour l'affichage UI
  challenge?: Challenge;
  content?: Content;
  userProfile?: UserProfile; // Votre modèle Profile ou User
}