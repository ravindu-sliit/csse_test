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

// Approximate center coordinates for each Sri Lanka district
export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Colombo':       { lat:  6.9271, lng: 79.8612 },
  'Gampaha':       { lat:  7.0840, lng: 80.0098 },
  'Kalutara':      { lat:  6.5854, lng: 79.9607 },
  'Kandy':         { lat:  7.2906, lng: 80.6337 },
  'Matale':        { lat:  7.4675, lng: 80.6234 },
  'Nuwara Eliya':  { lat:  6.9497, lng: 80.7891 },
  'Galle':         { lat:  6.0535, lng: 80.2210 },
  'Matara':        { lat:  5.9549, lng: 80.5550 },
  'Hambantota':    { lat:  6.1241, lng: 81.1185 },
  'Jaffna':        { lat:  9.6615, lng: 80.0255 },
  'Kilinochchi':   { lat:  9.3803, lng: 80.3770 },
  'Mannar':        { lat:  8.9810, lng: 79.9044 },
  'Vavuniya':      { lat:  8.7514, lng: 80.4971 },
  'Mullaitivu':    { lat:  9.2671, lng: 80.8128 },
  'Trincomalee':   { lat:  8.5874, lng: 81.2152 },
  'Batticaloa':    { lat:  7.7170, lng: 81.6924 },
  'Ampara':        { lat:  7.2991, lng: 81.6724 },
  'Kurunegala':    { lat:  7.4818, lng: 80.3609 },
  'Puttalam':      { lat:  8.0362, lng: 79.8283 },
  'Anuradhapura':  { lat:  8.3114, lng: 80.4037 },
  'Polonnaruwa':   { lat:  7.9403, lng: 81.0188 },
  'Badulla':       { lat:  6.9934, lng: 81.0550 },
  'Monaragala':    { lat:  6.8728, lng: 81.3507 },
  'Ratnapura':     { lat:  6.6828, lng: 80.3992 },
  'Kegalle':       { lat:  7.2513, lng: 80.3464 },
};

export const BROADCAST_CHANNELS = [
  { value: 'sms_blast',         label: 'Emergency SMS Blast',           description: '8.2M Subscribers' },
  { value: 'push_notification', label: 'Push Notifications (Disaster Portal)', description: '1.4M Registered Devices' },
  { value: 'tv_radio',          label: 'National TV/Radio Interruption', description: '6 Broadcasters Live Network' },
  { value: 'coastal_siren',     label: 'Coastal Siren Megaphones',      description: 'Active in selected western ports' },
] as const;