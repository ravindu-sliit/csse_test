export function generateWarningCode(hazardType: string, sequence: number): string {
  const year = new Date().getFullYear();
  const typeCode = hazardType.charAt(0).toUpperCase();
  return `DMC-${year}-${typeCode}${sequence.toString().padStart(2, '0')}`;
}

export function generateReportCode(district: string, sequence: number): string {
  const year = new Date().getFullYear();
  const districtCodes: Record<string, string> = {
    'Colombo': 'COL', 'Gampaha': 'GAM', 'Kalutara': 'KLT', 'Ratnapura': 'RTP',
    'Kegalle': 'KEG', 'Galle': 'GAL', 'Matara': 'MAT', 'Hambantota': 'HAM',
    'Kandy': 'KAN', 'Matale': 'MTL', 'Nuwara Eliya': 'NUW', 'Badulla': 'BAD',
    'Monaragala': 'MON', 'Jaffna': 'JAF', 'Trincomalee': 'TRI', 'Batticaloa': 'BAT',
    'Ampara': 'AMP', 'Kurunegala': 'KUR', 'Puttalam': 'PUT', 'Anuradhapura': 'ANU',
    'Polonnaruwa': 'POL', 'Mannar': 'MAN', 'Vavuniya': 'VAV', 'Kilinochchi': 'KIL', 'Mullaitivu': 'MUL',
  };
  const code = districtCodes[district] || district.slice(0, 3).toUpperCase();
  return `RPT-${year}-${code}-${sequence.toString().padStart(4, '0')}`;
}

export function generateDispatchCode(sequence: number): string {
  return `TX-${sequence.toString().padStart(4, '0')}`;
}