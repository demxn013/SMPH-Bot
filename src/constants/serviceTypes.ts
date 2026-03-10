export const SERVICE_TYPES = ['coding', 'editing', 'bosses', 'logos', 'skins', 'building', 'textures', 'thumbnails'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  coding: 'Coding',
  editing: 'Editing',
  bosses: 'Bosses',
  logos: 'Logos',
  skins: 'Skins',
  building: 'Building',
  textures: 'Textures',
  thumbnails: 'Thumbnails'
};
