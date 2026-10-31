export type PortalId = 'lead' | 'pro' | 'teach' | 'start' | 'student' | 'family';

export interface PortalItem {
  id: PortalId;
  nameEn: string;
  nameAr: string;
  targetRole: string;
  description: string;
  accentColor: string;
  bgLight: string;
  iconName: string;
  features: string[];
  stats: { label: string; value: string }[];
  primaryActionText: string;
}

export type ContentCategory = 'resource' | 'video' | 'news' | 'event';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  categoryLabel: string;
  date: string;
  subject: string;
  gradeLevel?: string;
  author?: {
    name: string;
    role: string;
    avatar?: string;
  };
  duration?: string;
  fileSize?: string;
  readsOrViews?: number;
  likes?: number;
  url?: string;
  tag?: string;
  eventDetails?: {
    date: string;
    time: string;
    locationType: 'حضوري' | 'عن بُعد عبر Teams';
    seatsLeft: number;
  };
}

export interface CommunityPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: {
    name: string;
    role: string;
    school: string;
    district: string;
  };
  subject: 'كيمياء' | 'فيزياء' | 'أحياء' | 'جيولوجيا' | 'علوم عامة' | 'طرق تدريس';
  grade: string;
  publishedDate: string;
  likes: number;
  saves: number;
  fileType?: string;
  attachmentsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  authorId?: string;
  commentsCount?: number;
}

export interface QuickTool {
  id: 'lab' | 'ai-assistant' | 'library' | 'academy';
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  badge: string;
  actionText: string;
}

export interface UserSession {
  isLoggedIn: boolean;
  name?: string;
  role?: string;
  portalId?: PortalId;
}
