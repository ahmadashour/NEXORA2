/**
 * Events Data Adapter
 * Converts between Backend Event DTOs and Frontend EventDetailViewModel and legacy ContentItem.
 * Phase 5 / P1.4.2 Architecture.
 */

import { ContentItem } from '../../types';
import {
  BackendEventDetailDTO,
  EventDetailViewModel,
} from '../../types/contracts';
import { formatArabicDate } from './communityAdapter';

/**
 * Computes remaining seats for display purposes.
 * ARCHITECTURAL NOTICE:
 * Client-side calculation of seatsLeft is purely for UI rendering and does NOT
 * guarantee availability. Concurrency and seat quotas are strictly enforced
 * atomically by the backend PostgreSQL database transaction.
 */
export function computeSeatsLeft(capacity: number, booked: number): number {
  return Math.max(0, (capacity || 0) - (booked || 0));
}

/**
 * Translates backend location_type into standard Arabic localization.
 */
export function mapLocationType(type: 'virtual' | 'in_person' | 'hybrid' | string): 'عن بُعد عبر Teams' | 'حضوري' | 'هجين' {
  switch (type) {
    case 'virtual':
      return 'عن بُعد عبر Teams';
    case 'in_person':
      return 'حضوري';
    case 'hybrid':
      return 'هجين';
    default:
      return 'عن بُعد عبر Teams';
  }
}

/**
 * Extracts a formatted time string from an ISO date string.
 */
export function formatArabicTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(d);
    }
  } catch {
    // ignore
  }
  return '06:00 م';
}

/**
 * Transforms BackendEventDetailDTO into EventDetailViewModel.
 */
export function adaptEventDetailFromBackend(dto: BackendEventDetailDTO): EventDetailViewModel {
  const seatsLeft = computeSeatsLeft(dto.seats_capacity, dto.seats_booked);
  const isFullyBooked = seatsLeft <= 0;
  const isRegisteredByMe = Boolean(dto.is_registered_by_me);

  return {
    id: dto.id,
    eventDate: formatArabicDate(dto.event_date),
    eventTime: formatArabicTime(dto.event_date),
    durationFormatted: `${dto.duration_minutes || 60} دقيقة`,
    locationTypeFormatted: mapLocationType(dto.location_type),
    locationAddress: dto.location_address || (dto.location_type === 'virtual' ? 'عبر منصة Teams' : 'قاعة المؤتمرات التعليمية'),
    speakerName: dto.speaker_name || 'خبير تربوي',
    speakerTitle: dto.speaker_title || 'أستاذ المناهج والتعليم',
    seatsCapacity: Number(dto.seats_capacity) || 0,
    seatsBooked: Number(dto.seats_booked) || 0,
    seatsLeft,
    isFullyBooked,
    isRegisteredByMe,
  };
}

/**
 * Transforms an array of backend event DTOs.
 */
export function adaptEventsList(dtos: BackendEventDetailDTO[]): EventDetailViewModel[] {
  if (!Array.isArray(dtos)) return [];
  return dtos.map(adaptEventDetailFromBackend);
}

/**
 * Adapts BackendEventDetailDTO to legacy ContentItem with eventDetails.
 */
export function adaptEventToLegacy(dto: BackendEventDetailDTO, title = 'ورشة عمل تدريبية', description = ''): ContentItem {
  const locType: 'حضوري' | 'عن بُعد عبر Teams' = dto.location_type === 'in_person' ? 'حضوري' : 'عن بُعد عبر Teams';

  return {
    id: dto.content_item_id || dto.id,
    title,
    description,
    category: 'event',
    categoryLabel: 'ورشة عمل تدريبية',
    date: formatArabicDate(dto.event_date),
    subject: 'التطوير المهني',
    author: {
      name: dto.speaker_name || 'خبير تربوي',
      role: dto.speaker_title || 'مدرب معتمد',
    },
    duration: `${dto.duration_minutes || 60} دقيقة`,
    eventDetails: {
      date: formatArabicDate(dto.event_date),
      time: formatArabicTime(dto.event_date),
      locationType: locType,
      seatsLeft: computeSeatsLeft(dto.seats_capacity, dto.seats_booked),
    },
  };
}
