export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara',
  'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota',
  'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu',
  'Trincomalee', 'Batticaloa', 'Ampara',
  'Kurunegala', 'Puttalam',
  'Anuradhapura', 'Polonnaruwa',
  'Badulla', 'Monaragala',
  'Ratnapura', 'Kegalle',
] as const;

export const HAZARD_TYPES = [
  { value: 'flood', label: 'Flood' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'cyclone', label: 'Cyclone' },
  { value: 'tsunami', label: 'Tsunami' },
  { value: 'drought', label: 'Drought' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'fallen_tree', label: 'Fallen Tree' },
  { value: 'road_block', label: 'Road Block' },
] as const;

export const SEVERITY_CONFIG = {
  watch:     { label: 'Watch',     colour: '#16a34a', bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  advisory:  { label: 'Advisory',  colour: '#2563eb', bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  warning:   { label: 'Warning',   colour: '#d97706', bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
  emergency: { label: 'Emergency', colour: '#dc2626', bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
} as const;

export const RIVER_BASINS = [
  'Kelani River Basin',
  'Kalu River Basin',
  'Mahaweli River Basin',
  'Galle Basin',
  'Nilwala River Basin',
  'Gin River Basin',
  'Attanagalu Oya Basin',
] as const;

export const BROADCAST_CHANNELS = [
  { value: 'sms_blast',         label: 'Emergency SMS Blast',           description: '8.2M Subscribers' },
  { value: 'push_notification', label: 'Push Notifications (Disaster Portal)', description: '1.4M Registered Devices' },
  { value: 'tv_radio',          label: 'National TV/Radio Interruption', description: '6 Broadcasters Live Network' },
  { value: 'coastal_siren',     label: 'Coastal Siren Megaphones',      description: 'Active in selected western ports' },
] as const;