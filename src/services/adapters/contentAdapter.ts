/**
 * Content Data Adapter
 * Converts between Backend Content Item DTOs and Frontend View Models.
 * Provides UnifiedContentViewModel and backward-compatible ContentItem mapping.
 * Phase 5 / P1.4.2 Architecture.
 */

import { ContentCategory, ContentItem } from '../../types';
import {
  BackendContentItemDTO,
  UnifiedContentViewModel,
} from '../../types/contracts';
import { formatArabicDate } from './communityAdapter';
import { adaptEventDetailFromBackend } from './eventsAdapter';

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'article':
      return 'مقال تربوي';
    case 'video':
      return 'فيديو تعليمي';
    case 'news':
      return 'أخبار تربوية';
    case 'event':
      return 'ورشة عمل وفعالية';
    case 'announcement':
      return 'إعلان رسمي';
    default:
      return 'محتوى تعليمي';
  }
}

function mapToContentCategory(category: BackendContentItemDTO['category']): ContentCategory {
  switch (category) {
    case 'video':
      return 'video';
    case 'news':
    case 'announcement':
      return 'news';
    case 'event':
      return 'event';
    case 'article':
    default:
      return 'resource';
  }
}

/**
 * Transforms BackendContentItemDTO into the modern UnifiedContentViewModel.
 */
export function adaptContentItemFromBackend(dto: BackendContentItemDTO): UnifiedContentViewModel {
  const isEvent = dto.category === 'event';
  const durationText = dto.read_time_minutes ? `${dto.read_time_minutes} دقائق` : '5 دقائق قراءة';
  const eventInfo = dto.event_detail ? adaptEventDetailFromBackend(dto.event_detail) : undefined;

  return {
    id: dto.id,
    title: dto.title || '',
    description: dto.description || '',
    category: mapToContentCategory(dto.category),
    categoryLabel: getCategoryLabel(dto.category),
    date: formatArabicDate(dto.created_at),
    subject: dto.subject || 'علوم عامة',
    gradeLevel: dto.grade_level || undefined,
    author: dto.author_name ? {
      name: dto.author_name,
      role: 'خبير تعليمي',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    } : undefined,
    duration: durationText,
    readsOrViews: Number(dto.views_count) || 0,
    url: dto.video_url || undefined,
    eventDetails: eventInfo ? {
      date: eventInfo.eventDate,
      time: eventInfo.eventTime,
      locationType: eventInfo.locationTypeFormatted === 'حضوري' ? 'حضوري' : 'عن بُعد عبر Teams',
      seatsLeft: eventInfo.seatsLeft,
    } : undefined,

    // Additional fields on UnifiedContentViewModel
    rawCategory: dto.category,
    isEvent,
    eventInfo,
    isFeatured: Boolean(dto.featured),
    status: dto.status || 'published',
  };
}

/**
 * Transforms an array of backend content item DTOs to UnifiedContentViewModels.
 */
export function adaptContentItemsList(dtos: BackendContentItemDTO[]): UnifiedContentViewModel[] {
  if (!Array.isArray(dtos)) return [];
  return dtos.map(adaptContentItemFromBackend);
}

/**
 * Adapts BackendContentItemDTO directly to the legacy ContentItem interface for UI sections.
 */
export function adaptContentItemToLegacy(dto: BackendContentItemDTO): ContentItem {
  return adaptContentItemFromBackend(dto);
}
