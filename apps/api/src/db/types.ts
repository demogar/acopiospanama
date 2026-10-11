import type { ColumnType, Generated, Selectable } from 'kysely';
import type { CenterType, Item, NeedLevel, OrganizerType, Province, ReportReason, Schedule } from '../domain';

type TimestampNull = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Id = Generated<string>;

export type CenterStatus = 'PUBLISHED' | 'CLOSED' | 'REMOVED';

export interface UsersTable {
  id: Id;
  email: string;
  name: Generated<string>;
  isModerator: Generated<boolean>;
  isAdmin: Generated<boolean>;
  totpSecretEnc: string | null;
  totpEnabledAt: TimestampNull;
  totpLastStep: number | null;
  recoveryCodes: Generated<string[]>;
  verifiedAt: TimestampNull;
  disabledAt: TimestampNull;
  lastInvitedAt: TimestampNull;
  mfaFailedCount: Generated<number>;
  mfaLockedUntil: TimestampNull;
  createdAt: Generated<Date>;
}

export interface AuthChallengesTable {
  id: Id;
  emailHmac: string;
  userId: string | null;
  codeHmac: string;
  codeGroup: string;
  codeEnc: string | null;
  sentCount: Generated<number>;
  lastSentAt: TimestampNull;
  nonceHash: string;
  attempts: Generated<number>;
  expiresAt: Timestamp;
  consumedAt: TimestampNull;
  createdAt: Generated<Date>;
}

export interface SessionsTable {
  id: Id;
  tokenHash: string;
  userId: string;
  isStaff: Generated<boolean>;
  createdAt: Generated<Date>;
  lastSeenAt: Generated<Date>;
  expiresAt: Timestamp;
  revokedAt: TimestampNull;
  mfaVerifiedAt: TimestampNull;
  stepUpAt: TimestampNull;
  userAgent: Generated<string>;
}

export interface CentersTable {
  id: Id;
  slug: string;
  name: string;
  centerType: Generated<CenterType>;
  organizerType: OrganizerType;
  organizerName: Generated<string>;
  province: Province;
  district: Generated<string>;
  community: Generated<string>;
  address: string;
  lat: number | null;
  lng: number | null;
  schedule: ColumnType<Schedule, string | undefined, string>;
  hoursNote: Generated<string>;
  contactName: Generated<string>;
  contactPhone: Generated<string>;
  contactWhatsapp: Generated<string>;
  contactConsentAt: TimestampNull;
  notes: Generated<string>;
  status: Generated<CenterStatus>;
  managerConfirmedAt: Generated<Date>;
  lastReminderAt: TimestampNull;
  createdBy: string | null;
  creatorEmailHmac: string | null;
  removedReason: Generated<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  publishedAt: TimestampNull;
  closedAt: TimestampNull;
}

export interface CenterNeedsTable {
  centerId: string;
  item: Item;
  level: NeedLevel;
  note: Generated<string>;
  updatedAt: Generated<Date>;
}

export interface CenterManagersTable {
  centerId: string;
  userId: string;
  createdAt: Generated<Date>;
  createdBy: string | null;
  acceptedAt: TimestampNull; // null = invitación pendiente (sin acceso)
}

export interface BlockedEmailsTable {
  emailHmac: string;
  createdAt: Generated<Date>;
}

export interface ReportsTable {
  id: Id;
  centerId: string;
  reason: ReportReason;
  details: Generated<string>;
  originHmac: string;
  status: Generated<'OPEN' | 'RESOLVED' | 'DISMISSED'>;
  resolvedBy: string | null;
  createdAt: Generated<Date>;
  resolvedAt: TimestampNull;
}

export interface ConfirmationsTable {
  id: Id;
  centerId: string;
  originHmac: string;
  createdAt: Generated<Date>;
}

export interface AuditEventsTable {
  id: Id;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  reason: Generated<string>;
  meta: ColumnType<unknown, string | undefined, never>;
  createdAt: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  authChallenges: AuthChallengesTable;
  sessions: SessionsTable;
  centers: CentersTable;
  centerNeeds: CenterNeedsTable;
  centerManagers: CenterManagersTable;
  blockedEmails: BlockedEmailsTable;
  reports: ReportsTable;
  confirmations: ConfirmationsTable;
  auditEvents: AuditEventsTable;
}

export type User = Selectable<UsersTable>;
export type SessionRow = Selectable<SessionsTable>;
export type Center = Selectable<CentersTable>;
