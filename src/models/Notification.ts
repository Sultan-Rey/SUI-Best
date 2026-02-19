export interface Notification {
  id: string, 
  category: string,
  title: string,
  message: string,
  priority: 'high' |'medium' |'low',
  status: 'read' | 'unread',
  createdAt:  Date,
  recipients: {
    type: string,
    userIds: string[]
  },
  action: {
    type: string,
    label: string,
    route: string[]
  },
  effects: {
    sound: string,
    vibration: boolean,
    badge: boolean
  }
};