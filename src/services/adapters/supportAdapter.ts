/**
 * Support & Inquiries Data Adapter
 * Converts between Frontend Contact Modal forms and Backend Support DTOs.
 * Phase 5 / P1.4.2 Architecture.
 */

import {
  BackendContactInquiryDTO,
  CreateInquiryPayload,
} from '../../types/contracts';
import { formatArabicDate } from './communityAdapter';

export interface FrontendInquiryInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  portalCode?: string;
}

export interface AdaptedInquiryResponse {
  id: string;
  status: string;
  createdAt: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  phone?: string | null;
  portalCode?: string | null;
}

/**
 * Transforms frontend contact form input into backend CreateInquiryPayload.
 * Note: Maps frontend 'name' to backend 'full_name' and 'portalCode' to 'portal_code'.
 */
export function adaptCreateInquiryPayload(input: FrontendInquiryInput): CreateInquiryPayload {
  return {
    full_name: input.name?.trim() || '',
    email: input.email?.trim().toLowerCase() || '',
    subject: input.subject?.trim() || '',
    message: input.message?.trim() || '',
    phone: input.phone?.trim() || null,
    portal_code: input.portalCode?.trim() || null,
  };
}

/**
 * Transforms BackendContactInquiryDTO to frontend friendly response model.
 */
export function adaptInquiryResponse(dto: BackendContactInquiryDTO): AdaptedInquiryResponse {
  return {
    id: dto.id,
    status: dto.status || 'received',
    createdAt: formatArabicDate(dto.created_at),
    fullName: dto.full_name,
    email: dto.email,
    subject: dto.subject,
    message: dto.message,
    phone: dto.phone,
    portalCode: dto.portal_code,
  };
}
