/**
 * Security TDD Specification Runner for firestore.rules
 * Validates the 12 "Dirty Dozen" attack payloads defined in security_spec.md.
 * Run against Firebase Emulator Suite when validating emulator rules locally.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated appointment read',
    collection: 'appointments',
    operation: 'list',
    payload: {auth: null},
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified admin email spoof',
    collection: 'services',
    operation: 'create',
    payload: {
      auth: {uid: 'attacker', email: 'evoluatechbr@gmail.com', email_verified: false},
      id: 'corte-degrade',
      priceCents: 1,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-role escalation to admin on user create',
    collection: 'users',
    operation: 'create',
    payload: {
      uid: 'user-1',
      name: 'Attacker',
      phone: '11999999999',
      email: 'attacker@gmail.com',
      role: 'admin',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Role escalation on user profile update',
    collection: 'users',
    operation: 'update',
    payload: {
      role: 'barber',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field injection on appointment create',
    collection: 'appointments',
    operation: 'create',
    payload: {
      id: 'apt-shadow',
      serviceId: 'corte-degrade',
      priceCents: 4500,
      isPaid: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Price tampering on appointment create',
    collection: 'appointments',
    operation: 'create',
    payload: {
      id: 'apt-cheap',
      serviceId: 'corte-degrade',
      priceCents: 1,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Cross-client appointment list without owner filter',
    collection: 'appointments',
    operation: 'list',
    payload: {
      requesterUid: 'user-a',
      targetClientId: 'user-b',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Identity spoofing clientId on booking create',
    collection: 'appointments',
    operation: 'create',
    payload: {
      requesterUid: 'user-a',
      clientId: 'user-b',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned appointment without atomic availabilitySlot lock',
    collection: 'appointments',
    operation: 'create',
    payload: {
      id: 'apt-no-lock',
      slotLockId: 'missing-lock',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal state resurrection from Cancelado to Confirmado',
    collection: 'appointments',
    operation: 'update',
    payload: {
      previousStatus: 'Cancelado',
      status: 'Confirmado',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized string / ID poisoning',
    collection: 'appointments',
    operation: 'create',
    payload: {
      id: 'a'.repeat(200),
      notes: 'x'.repeat(2000),
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Client-backdated createdAt timestamp forgery',
    collection: 'appointments',
    operation: 'create',
    payload: {
      createdAt: '2020-01-01T00:00:00.000Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
