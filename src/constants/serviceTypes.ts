export const SERVICE_TYPES = ['builders', 'developers', 'artists', 'editors'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  builders: 'Builders',
  developers: 'Developers',
  artists: 'Artists',
  editors: 'Editors'
};
