# UC03 SPEC — Coordinate Emergency Resources & Shelters
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 | Member: Pathirana P A D (IT23689008)

---

## 1. Use Case Summary

| Field | Value |
|---|---|
| Use Case ID | UC03 |
| Name | Coordinate Emergency Resources & Shelters |
| Primary Actor | District Officer |
| Secondary Actors | Rescue Team (receives mission, updates status), NGO/Donor Organization (provides resources) |
| Goal | During an active disaster event, a District Officer manages emergency shelters (registration + occupancy), dispatches rescue teams to affected areas, and manages/distributes relief resources (food, water, medicine). |
| Preconditions | User authenticated as `district_officer`. An active disaster event / warning is in effect. At least one shelter, rescue team, and supply record exists in the system (seeded). |
| Postconditions | Shelter records reflect current occupancy. Rescue teams have updated dispatch status. Supply dispatches are logged with transit status. All changes visible on the live operations dashboard. |
| Trigger | A hazard warning has been issued and the District Officer opens the coordination portal to begin response management |

---

## 2. Main Flows

### Flow A — Register Emergency Shelter

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | District Officer | Logs in and navigates to Shelters | Safe Shelter Registry page loads showing total capacity, current occupancy, available spots across all district shelters |
| 2 | District Officer | Clicks "Register Shelter" button | Shelter registration form modal/page opens |
| 3 | District Officer | Fills: Shelter Name, Address, District (pre-filled with officer's district), Capacity, Contact Number | |
| 4 | District Officer | Clicks "Register Shelter" | Client validates form. POST request to API. |
| 5 | System | Saves shelter to `shelters` table. `currentOccupancy = 0`, `status = OPEN`. | |
| 6 | System | Returns success. Shelter appears in registry list. | Shelter list refreshes. New shelter shows with 0% occupancy bar (grey). |

### Flow B — Update Shelter Occupancy

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | District Officer | On Shelter Registry page, clicks a shelter row or "Update Occupancy" | Occupancy update form shown (inline or modal) |
| 2 | District Officer | Enters new occupant count in "New Occupant Count" field | |
| 3 | District Officer | Clicks "Update Occupancy" | System validates: new count must be ≤ capacity |
| 4 (success) | System | Updates `currentOccupancy`. Logs to `shelter_occupancy_logs`. Updates `status = FULL` if at capacity. | Occupancy bar colour updates: green (<70%), amber (70–89%), red (90–100%), full badge (100%) |
| 4 (failure) | System | Returns error `SHELTER_CAPACITY_EXCEEDED` | Red error banner: "Shelter Capacity Exceeded. No additional occupants can be assigned." Update blocked. |

### Flow C — Check Shelter Availability

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | District Officer | On Shelter Registry, views the "Available Spots" column | Computed: `capacity - currentOccupancy` |
| 2 | District Officer | Optionally filters by district | |
| 3 | System | If `currentOccupancy >= capacity`, shows "Full" badge on that row | |

### Flow D — Dispatch Rescue Team

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | District Officer | Navigates to "Rescue Dispatch" | Rescue Team Deployment Command page loads |
| 2 | System | Lists all rescue teams with current status badges | Available (green), En Route (blue), Deployed (orange), Returning (grey) |
| 3 | District Officer | Selects a team from the "Operational Emergency Units" list | Team row highlights |
| 4 | District Officer | Fills New Mission Deployment Form: Select Rescue Team (dropdown), Target Crisis District, Mission Criticality (HIGH/MEDIUM/ROUTINE), Mandatory Gear Checklist | |
| 5 | District Officer | Clicks "DISPATCH COMMAND NOW" | Client validates: team must be AVAILABLE |
| 6 (success) | System | Creates `RescueDispatch` record. Updates team `status = DISPATCHED`. | Team row updates to "Deployed" badge. Confirmation shown. |
| 6 (failure) | System | Returns `TEAM_UNAVAILABLE` error | Error: "TEAM-A is currently deployed. Select an available team." |

### Flow E — Manage & Record Relief Supply Distribution

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | District Officer | Navigates to "Supply Chain" | Relief Supply Chain Command page loads with inventory summary cards |
| 2 | System | Shows current inventory: Food Packs, Clean Drinking Water, Emergency Medicine, Winter Blankets, Tarpaulins | Each with quantity, unit, and a colour-coded usage bar |
| 3 | District Officer | Clicks "Create Dispatch Bill" | Supply dispatch form opens |
| 4 | District Officer | Selects supply type, destination shelter, quantity | |
| 5 | District Officer | Submits dispatch | System creates `SupplyDispatch` record with `transitStatus = PREPARING`. Deducts quantity from `ReliefSupply`. |
| 6 | District Officer | Later updates transit status to IN_TRANSIT, then DELIVERED | `PATCH /api/dispatches/:id/status` |

---

## 3. Alternative Flows

### A1 — Shelter Capacity Full (Handle Shelter Full)
- Trigger: Shelter reaches 100% occupancy
- System automatically sets `shelter.status = FULL`
- On the National Map, shelter pin shows "SHELTER CAPACITY 90% — RATNAPURA" amber label
- Officer must find alternative shelter: `GET /api/shelters?district=Ratnapura&status=open`
- Officer may update occupancy for another shelter instead

### A2 — No Available Rescue Team (Handle No Available Team)
- Trigger: Officer tries to dispatch but all teams are `DISPATCHED`, `EN_ROUTE`, or `ON_MISSION`
- System returns `TEAM_UNAVAILABLE` for all team selections
- Officer sees "No teams currently available in your district"
- Officer may: (a) dispatch a RETURNING team and accept the delay; (b) request cross-district support (logged as a note — out of scope for this UC)

### A3 — NGO Provides Resources
- An `organization` record of type `NGO` or `Donor` is already in the system
- District Officer creates a `ReliefSupply` record linked to that organization
- No special flow — same supply management as above

---

## 4. Exception Flows

### E1 — Shelter Registration Fails (Duplicate Name in District)
- Server checks: unique constraint on `(name, district)` combination
- If duplicate: `DUPLICATE_ENTRY` error
- Message: "A shelter with this name already exists in Colombo district."

### E2 — Negative Occupancy Update
- Client validation: `newOccupancy >= 0`
- Server validation: same check via Zod schema
- Error: "Occupancy count cannot be negative."

### E3 — Supply Quantity Insufficient
- Officer tries to dispatch more than available quantity
- Server checks: `dispatch.quantity <= supply.quantity`
- Error code: `INSUFFICIENT_SUPPLY`
- Message: "Only 200 Food Pack units are available. You requested 400."

### E4 — Session / Role Mismatch
- A `dmc_officer` tries to access `/officer/coordination/*` (District Officer only routes)
- `authorizeRoles('district_officer')` middleware returns 403
- Error: `FORBIDDEN`

---

## 5. UI Pages & Components (UC03)

### Portal: District Officer uses the "Command Center" view of the Officer Portal
The nav differs from the standard officer nav:
- Dashboard → "Emergency Resource Command"
- Shelters
- Rescue Dispatch
- Supply Chain
- Live Operations
- Settings

### Page 1: Emergency Resource Command Dashboard (`/officer/coordination/dashboard`)
**Components:**
- `SriLankaMap` (full-width left side) with:
  - Shelter pins (house icon) — green/orange/red based on occupancy
  - Rescue team pins (team icon) — showing deployment location labels
  - Supply hub pins (box icon)
  - Alert banners at bottom of map: "ALERT: Kelani River water levels rising..."
- `OperationalCommandSummary` panel (right):
  - Rescue Teams Deployed: `X / Y Teams`
  - Active Safe Shelters: `N Open`
  - Supply Hubs Active: `N Centers`
- `ImmediateCommandActions` panel:
  - "Open New Shelter" dark button
  - "Dispatch Rescue Unit" outline button
  - "Initiate Supply Flight" outline button

**Data Sources:**
- `GET /api/analytics/coordination-summary`
- `GET /api/shelters?district={officerDistrict}`
- `GET /api/rescue-teams?district={officerDistrict}`
- Socket.io: `shelter_updated`, `team_dispatched` events refresh data

### Page 2: Rescue Team Deployment Command (`/officer/coordination/rescue-dispatch`)
**Layout:** Left panel (team list) + Right panel (dispatch form)

**Left panel — `RescueTeamList`:**
- Each row: Team Code + Name (bold), Member count • Sector, Status badge right-aligned
- Status badges: "Deployed" (orange), "En Route" (blue), "Available" (green), "Returning" (grey)
- Clicking a row populates the dispatch form

**Right panel — `DispatchForm`:**
- "New Mission Deployment Form" heading
- "SELECT RESCUE TEAM" dropdown (shows all teams, pre-selects clicked row)
- "TARGET CRISIS DISTRICT" dropdown
- "MISSION CRITICALITY" radio group: HIGH (red), MEDIUM (amber), ROUTINE (grey)
- "MANDATORY GEAR CHECKLIST" — list of checkboxes
- "DISPATCH COMMAND NOW" red button (full-width)

**Gear checklist items (predefined):**
- Inflatable Assault Boats
- Emergency Paramedic Trauma Kits
- Chainsaw Heavy Rescue Kit
- Rope and Harness Equipment
- Radio Communication Units
- Water Purification Units

### Page 3: Safe Shelter Registry & Monitoring (`/officer/coordination/shelters`)
**Components:**
- Stat cards: Total Shelter Capacity, Current Occupancy, Available Spots
- "Active Relief Camps & Safe Havens" table header with "Filter by District" and "Register Shelter" buttons
- `ShelterTable` columns: Shelter Name, District, Capacity (Pax), Occupancy (progress bar), Status badge, Amenities icons
- Amenities icons: 🔥 Fire, ⚡ Electricity, ⚕ Medical, ☕ Food & Water
- Status badges: "Open" (green), "Full" (red), "Closed" (grey)
- Occupancy bar colours:
  - `< 70%` → green bar
  - `70–89%` → amber bar
  - `90–100%` → red bar
  - `100%` → Full badge, bar solid red

### Page 4: Relief Supply Chain Command (`/officer/coordination/supply-chain`)
**Components:**
- 5 summary stat cards: Food Packs (quantity + units), Clean Drinking Water, Emergency Medicine, Winter Blankets, Tarpaulins & Tents — each with colour-coded usage bar
- "Active Relief Supply Log" table: Dispatched ID, Destination Shelter, Supplies Class, Quantity, Transit Status badge
- Transit Status badges: "In Transit" (amber), "Preparing" (grey), "Delivered" (green)
- "Create Dispatch Bill" button (top right)

### Page 5: Crisis Live Ops Control (`/officer/coordination/live-ops`)
**Components:**
- 4 stat cards: Evacuated Civilians (with today's delta), Active Shelters (% capacity), Deployed Squads (reserve indicator), Rations Distributed (scheduled count)
- `LiveIncidentTimelineLog` — chronological list with coloured dot indicators (red = critical, amber = warning, green = resolved)
- `NationalDeploymentTelemetry` panel — horizontal progress bars: Military Teams Allocated (%), Shelter Beds Occupancy (%), Rescue Air Support Reserve (%)

---

## 6. API Endpoints (UC03)

| Method | Endpoint | Auth Role | Description |
|---|---|---|---|
| `POST` | `/api/shelters` | district_officer | Register a new shelter |
| `GET` | `/api/shelters` | any officer | List shelters (filterable by district, status) |
| `GET` | `/api/shelters/:id` | any officer | Get shelter details |
| `PATCH` | `/api/shelters/:id/occupancy` | district_officer | Update shelter occupancy |
| `PATCH` | `/api/shelters/:id/status` | district_officer | Open/close a shelter |
| `GET` | `/api/rescue-teams` | any officer | List rescue teams (filterable by status, district) |
| `POST` | `/api/rescue-teams` | district_officer | Register a new rescue team |
| `POST` | `/api/dispatches` | district_officer | Dispatch a rescue team |
| `PATCH` | `/api/dispatches/:id/status` | district_officer, rescue_team | Update dispatch mission status |
| `GET` | `/api/supplies` | any officer | List relief supplies |
| `POST` | `/api/supplies` | district_officer | Register a new supply item |
| `POST` | `/api/supply-dispatches` | district_officer | Create a supply dispatch bill |
| `PATCH` | `/api/supply-dispatches/:id/status` | district_officer | Update transit status |
| `GET` | `/api/analytics/coordination-summary` | district_officer, dmc_officer | Stats for coordination dashboard |

**POST /api/shelters — Request Body:**
```json
{
  "name": "Rathmalana Maha Vidyalaya",
  "address": "Rathmalana, Colombo",
  "district": "Colombo",
  "capacity": 500,
  "contactNumber": "071 234 5678",
  "amenities": ["water", "electricity", "medical", "food"]
}
```

**PATCH /api/shelters/:id/occupancy — Request Body:**
```json
{
  "newOccupancy": 350
}
```

**PATCH /api/shelters/:id/occupancy — Error Response (409):**
```json
{
  "success": false,
  "error": {
    "code": "SHELTER_CAPACITY_EXCEEDED",
    "message": "Cannot update occupancy. New count (520) exceeds shelter capacity (500).",
    "field": "newOccupancy"
  }
}
```

**POST /api/dispatches — Request Body:**
```json
{
  "teamId": "clxxx...",
  "targetDistrict": "Gampaha",
  "missionDetails": "Flood rescue in Gampaha District Zone 4 - residential area inundated",
  "criticality": "HIGH",
  "gearChecklist": ["inflatable_boats", "paramedic_kit"]
}
```

**POST /api/supply-dispatches — Request Body:**
```json
{
  "supplyId": "clyyy...",
  "shelterId": "clzzz...",
  "destinationLabel": "Ratnapura Central School",
  "quantity": 400,
  "unit": "Packs"
}
```

---

## 7. Sequence Diagram (Text Description)

```
District Officer → Officer Portal : login()
Officer Portal → Auth Controller : POST /api/auth/login
Auth Controller → Auth Service : validateCredentials()
Auth Service → DB : findUser(email)
DB → Auth Service : user { role: "district_officer", district: "Colombo" }
Auth Service → Auth Controller : { accessToken, refreshToken }
Auth Controller → Officer Portal : 200 { tokens, user }
Officer Portal → District Officer : navigate to /coordination/dashboard

District Officer → Coordination Dashboard : openPage()
Coordination Dashboard → Coordination API : GET /api/analytics/coordination-summary
Coordination API → Analytics Service : getCoordinationSummary(district="Colombo")
Analytics Service → DB : count shelters, rescue teams, supplies
DB → Analytics Service : { shelterCount, teamCount, ... }
Analytics Service → Coordination API : summaryData
Coordination API → Coordination Dashboard : 200 { teams, shelters, hubs }
Coordination Dashboard → District Officer : render map + command summary

--- FLOW B: Update Shelter Occupancy ---

District Officer → Shelter Registry UI : openShelters()
Shelter Registry UI → Shelter Controller : GET /api/shelters?district=Colombo
Shelter Controller → Shelter Service : listShelters({ district: "Colombo" })
Shelter Service → DB : findMany({ where: { district } })
DB → Shelter Service : shelters[]
Shelter Service → Shelter Controller : shelters
Shelter Controller → Shelter Registry UI : 200 { shelters, totals }

District Officer → Shelter Registry UI : clickUpdateOccupancy("Rathmalana MV")
District Officer → Shelter Registry UI : enterNewCount(350)
District Officer → Shelter Registry UI : clickUpdate()

Shelter Registry UI → Shelter Controller : PATCH /api/shelters/:id/occupancy { newOccupancy: 350 }
Shelter Controller → Shelter Service : updateOccupancy(id, 350, officerId)
Shelter Service → DB : findUnique(id) → check capacity
  alt [newOccupancy <= capacity]
    Shelter Service → DB : $transaction([
      update shelter.currentOccupancy = 350,
      create shelterOccupancyLog { previous: 320, new: 350 }
    ])
    DB → Shelter Service : updated shelter
    Shelter Service → Socket.io : emit("shelter_updated", { shelterId, newOccupancy: 350 })
    Shelter Service → Shelter Controller : updatedShelter
    Shelter Controller → Shelter Registry UI : 200 { shelter }
    Shelter Registry UI → District Officer : update occupancy bar to 70%
  else [newOccupancy > capacity]
    Shelter Service → Shelter Controller : throw ShelterCapacityExceededError
    Shelter Controller → Shelter Registry UI : 409 { error: SHELTER_CAPACITY_EXCEEDED }
    Shelter Registry UI → District Officer : show red error banner
  end

--- FLOW D: Dispatch Rescue Team ---

District Officer → Rescue Dispatch UI : openPage()
Rescue Dispatch UI → Rescue Controller : GET /api/rescue-teams?district=Colombo
Rescue Controller → Rescue Service : listTeams({ district: "Colombo" })
Rescue Service → DB : findMany(rescue_teams)
DB → Rescue Service : teams[]
Rescue Dispatch UI → District Officer : render team list with status badges

District Officer → Rescue Dispatch UI : selectTeam("TEAM-C")
District Officer → Rescue Dispatch UI : setDistrict("Gampaha")
District Officer → Rescue Dispatch UI : setCriticality("HIGH")
District Officer → Rescue Dispatch UI : checkGear(["inflatable_boats", "paramedic_kit"])
District Officer → Rescue Dispatch UI : clickDispatch()

Rescue Dispatch UI → Rescue Controller : POST /api/dispatches { teamId, targetDistrict, criticality, gear }
Rescue Controller → Rescue Service : dispatchTeam(dto, officerId)
Rescue Service → DB : findTeam(teamId) → check status
  alt [team.status === AVAILABLE]
    Rescue Service → DB : $transaction([
      create rescueDispatch { ... },
      update rescueTeam.status = DISPATCHED
    ])
    DB → Rescue Service : { dispatch, team }
    Rescue Service → Socket.io : emit("team_dispatched", { teamId, district })
    Rescue Service → Rescue Controller : dispatch
    Rescue Controller → Rescue Dispatch UI : 201 { dispatch }
    Rescue Dispatch UI → District Officer : update TEAM-C badge to "Deployed"
  else [team.status !== AVAILABLE]
    Rescue Service → Rescue Controller : throw TeamUnavailableError
    Rescue Controller → Rescue Dispatch UI : 409 { error: TEAM_UNAVAILABLE }
    Rescue Dispatch UI → District Officer : show error "TEAM-C is currently deployed"
  end
```

---

## 8. Business Logic Notes

- District Officers can only see and modify shelters, teams, and supplies **in their assigned district**. The service layer filters by `req.user.district`.
- `dmc_officer` role bypasses the district filter and can see all data.
- Shelter occupancy logs are immutable — no update or delete. They form the audit trail.
- When `currentOccupancy >= capacity`, the shelter `status` auto-sets to `FULL`. When `currentOccupancy < capacity` and status was `FULL`, it auto-resets to `OPEN`.
- Supply quantity is decremented immediately on `SupplyDispatch` creation. If dispatch is cancelled (future feature), quantity is restored.
- Rescue team status lifecycle must follow: `AVAILABLE → DISPATCHED → EN_ROUTE → ON_MISSION → RETURNING → AVAILABLE`. Skip states are not allowed.
- Mission gear checklist is stored as a string array in `gearChecklist` — free form per dispatch.
- The `Live Operations` page data aggregates in real-time from shelters, dispatches, and supply deliveries. It is read-only.
