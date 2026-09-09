# PROJECT OVERVIEW
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 — SE3070 Assignment 01

---

## 1. System Purpose

Sri Lanka currently manages disaster coordination through fragmented, manual channels — phone calls, radio, WhatsApp groups, and paper reports. This results in delayed warnings, evacuation delays, duplication of effort across agencies, and relief supplies failing to reach affected areas in time.

This system is a **centralized digital platform** for the Disaster Management Centre (DMC) of Sri Lanka to:
- Issue and broadcast hazard warnings to citizens in real time
- Collect and verify hazard field reports from citizens
- Coordinate emergency shelters, rescue teams, and relief resources
- Analyse disaster response data and generate statistical reports

The system is **NOT a full production deployment**. It is an Assignment 01 deliverable for SE3070 demonstrating UML Functional Design and User Interaction Design for the described case study.

---

## 2. Project Scope

### In Scope
- Web application (officer portal) for DMC Officers, DMC Duty Officers, and District Officers
- Mobile-responsive web application (citizen portal) for Citizens
- 4 core use cases (UC01–UC04) fully implemented
- Role-based authentication and access control
- Real-time dashboard data (polling or WebSocket)
- Offline report drafting with sync (citizen app)
- Maps showing Sri Lanka districts and incidents
- Report generation and export (PDF, Excel, CSV)

### Out of Scope
- Native iOS/Android apps (using responsive web instead)
- Real SMS gateway integration (simulated in DB)
- Real audible alert hardware
- Payment or donation processing
- Full production infrastructure (no Kubernetes, no CDN)
- Multi-language UI (English only for implementation)

---

## 3. Users & Roles

| Role | Description | Portal |
|---|---|---|
| `citizen` | Any registered Sri Lankan citizen. Can submit hazard reports and receive warnings. | Citizen Web App (mobile-responsive) |
| `dmc_officer` | DMC Officer at national level. Can create and broadcast hazard warnings. Also has access to analytics. | Officer Web App |
| `dmc_duty_officer` | DMC Duty Officer. Monitors incoming citizen reports and verifies or rejects them. | Officer Web App |
| `district_officer` | District-level officer. Manages shelters, rescue teams, and relief resources in their district. | Officer Web App |
| `rescue_team` | Rescue team that receives dispatch assignments and updates mission status. | Officer Web App (limited view) |

> Note: `dmc_officer` and `dmc_duty_officer` may share a login but see different dashboard sections based on role. The system assigns a single `role` field per user.

---

## 4. Use Cases

| ID | Name | Primary Actor | Summary |
|---|---|---|---|
| UC01 | Issue & Broadcast Hazard Warning | DMC Officer | Creates a hazard warning with severity, affected districts/river basin, and broadcasts via push notification, SMS log, and TV/radio simulation |
| UC02 | Submit & Verify Hazard Report | Citizen + DMC Duty Officer | Citizen submits a field report with GPS, photo, description. Duty officer reviews, verifies or rejects it |
| UC03 | Coordinate Emergency Resources & Shelters | District Officer | Registers shelters, tracks occupancy, dispatches rescue teams, manages and records relief supply distribution |
| UC04 | Analyse Disaster Response & Generate Reports | DMC Officer | Views analytics dashboards (warnings, shelter occupancy, resource distribution, citizen reach) and generates downloadable reports |

---

## 5. Team Members

| Member | Student ID | Assigned Use Case |
|---|---|---|
| Sooriyaarachchi E A R N | IT23829510 | UC01 – Issue & Broadcast Hazard Warning |
| Jayakodi P B S K | IT23827608 | UC02 – Submit & Verify Hazard Report |
| Pathirana P A D | IT23689008 | UC03 – Coordinate Emergency Resources & Shelters |
| Pathirana P D R S | IT23843752 | UC04 – Analyse Disaster Response & Generate Reports |

Each member is responsible for the full vertical slice of their use case: backend API, frontend UI, and integration.

---

## 6. Key Business Rules

1. A citizen hazard report **must be verified** by a DMC Duty Officer before it can influence any official warning level.
2. A warning broadcast is **one-way** — it cannot be retracted from citizen devices once sent, but it can be marked `cancelled` in the system, which stops further dispatch.
3. Shelter occupancy **cannot exceed capacity** — the system must block updates that would cause this and show an error.
4. Rescue teams have a status lifecycle: `available` → `dispatched` → `en_route` → `on_mission` → `returning` → `available`.
5. Relief supply records must be created before they can be allocated to a shelter or district.
6. All analytics data is **read-only** — officers cannot modify historical records from the analytics dashboard.
7. Citizens can save a report offline and sync it later if the network is unavailable.
8. District Officers can only manage shelters, teams, and resources **within their assigned district**.
9. DMC Officers can see **all districts**.
10. Warning severity levels are: `watch` → `advisory` → `warning` → `emergency` (escalating).

---

## 7. Sri Lanka Geographic Context

The system is specifically built for Sri Lanka. The following districts are supported:

```
Western Province:   Colombo, Gampaha, Kalutara
Central Province:   Kandy, Matale, Nuwara Eliya
Southern Province:  Galle, Matara, Hambantota
Northern Province:  Jaffna, Kilinochchi, Mannar, Vavuniya, Mullaitivu
Eastern Province:   Trincomalee, Batticaloa, Ampara
North Western:      Kurunegala, Puttalam
North Central:      Anuradhapura, Polonnaruwa
Uva Province:       Badulla, Monaragala
Sabaragamuwa:       Ratnapura, Kegalle
```

Key River Basins referenced in the system:
- Kelani River Basin (Colombo, Gampaha)
- Kalu River Basin (Kalutara, Ratnapura)
- Mahaweli River Basin (Kandy, Trincomalee)
- Galle Basin (Galle, Kalutara)
- Nilwala River Basin (Matara)

---

## 8. Disaster Types Supported

| Code | Name |
|---|---|
| `flood` | Flood |
| `landslide` | Landslide |
| `cyclone` | Cyclone |
| `tsunami` | Tsunami |
| `drought` | Drought |
| `lightning` | Lightning / Thunderstorm |
| `fallen_tree` | Fallen Tree |
| `road_block` | Road Block |

---

## 9. Notification Channels (Simulated)

The system simulates these channels — actual delivery to telcos/broadcasters is NOT implemented, but the dispatch records and delivery status are tracked in the database:

| Channel | Description |
|---|---|
| `sms_blast` | SMS to registered phone numbers in target district |
| `push_notification` | Firebase FCM push to registered devices |
| `tv_radio` | National TV/Radio broadcaster override simulation |
| `coastal_siren` | Coastal siren megaphone network (toggle only) |

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Usability | Emergency-focused UI: large buttons, high-contrast severity colours, minimal cognitive load |
| Offline Support | Citizen report form must work offline; data syncs when connection restores |
| Responsiveness | Citizen portal must be fully functional on mobile browsers (375px and up) |
| Performance | Dashboard pages must load within 3 seconds on standard broadband |
| Security | JWT-based auth, role-based route guards, passwords hashed with bcrypt |
| Accessibility | All interactive elements must be keyboard-accessible and have ARIA labels |
| Data Integrity | Shelter occupancy updates must use DB-level constraints to prevent overflow |

---

## 11. Severity Colour System

Used consistently across all UI components:

| Level | Label | Colour | Hex |
|---|---|---|---|
| 1 | Watch | Green | `#16a34a` |
| 2 | Advisory | Blue | `#2563eb` |
| 3 | Warning | Yellow/Amber | `#d97706` |
| 4 | Emergency | Red | `#dc2626` |

---

## 12. Deliverable Summary

This repository contains:
- `/docs` — All specification documents (this folder)
- `/backend` — Node.js + Express REST API
- `/frontend` — React + TypeScript web application (officer + citizen portals)
- `/references` — Original assignment diagrams and wireframes
