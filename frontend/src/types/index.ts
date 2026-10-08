export type UserRole = 'CITIZEN' | 'VOLUNTEER' | 'DMC_OFFICER' | 'DMC_DUTY_OFFICER' | 'DISTRICT_OFFICER' | 'RESCUE_TEAM';
export type HazardType = 'flood' | 'landslide' | 'cyclone' | 'tsunami' | 'drought' | 'lightning' | 'fallen_tree' | 'road_block';
export type SeverityLevel = 'watch' | 'advisory' | 'warning' | 'emergency';
export type WarningStatus = 'active' | 'expired' | 'cancelled';
export type ReportStatus = 'pending_verification' | 'under_review' | 'verified' | 'rejected';
export type RescueTeamStatus = 'available' | 'dispatched' | 'en_route' | 'on_mission' | 'returning';
export type ShelterStatus = 'open' | 'full' | 'closed';
export type TransitStatus = 'preparing' | 'in_transit' | 'delivered';
export type MissionCriticality = 'high' | 'medium' | 'routine';

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  district?: string;
  status: string;
}

export interface Warning {
  id: string;
  warningCode: string;
  hazardType: HazardType;
  severityLevel: SeverityLevel;
  message: string;
  issuedTime: string;
  expiryTime?: string;
  targetDistricts: string[];
  targetRiverBasin?: string;
  status: WarningStatus;
  issuedBy?: { id: string; name: string };
  // GPS location fields
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  sourceReportId?: string;
}

export interface HazardReport {
  id: string;
  reportCode: string;
  hazardType: HazardType;
  description: string;
  photoUrls: string[];
  gpsLatitude: number;
  gpsLongitude: number;
  district: string;
  locationLabel?: string;
  status: ReportStatus;
  severityEstimate?: SeverityLevel;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  citizen?: { id: string; user: { name: string; phoneNumber?: string } };
  verifiedBy?: { id: string; name: string };
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  district: string;
  capacity: number;
  currentOccupancy: number;
  contactNumber?: string;
  status: ShelterStatus;
  amenities: string[];
  latitude?: number;
  longitude?: number;
}

export interface RescueTeam {
  id: string;
  teamCode: string;
  teamName: string;
  teamType: string;
  contactNumber: string;
  currentLocation?: string;
  district: string;
  status: RescueTeamStatus;
  memberCount: number;
}

export interface ReliefSupply {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  status: string;
}

export interface SupplyDispatch {
  id: string;
  dispatchCode: string;
  destinationLabel: string;
  quantity: number;
  unit: string;
  transitStatus: TransitStatus;
  dispatchedAt: string;
  supply?: { name: string; category: string };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}