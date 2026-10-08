import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { authorizeRoles } from '../middleware/authorizeRoles';
import { validateRequest } from '../middleware/validateRequest';
import {
  createShelterSchema, geocodeShelterSchema, updateOccupancySchema,
  dispatchTeamSchema, createSupplySchema, createSupplyDispatchSchema, updateTransitStatusSchema
} from '../schemas/shelter.schema';
import { createShelter, geocodeShelter, getShelters, getShelter, updateOccupancy, deleteShelter, getSheltersSummary } from '../controllers/shelter.controller';
import { getTeams, dispatchTeam, updateDispatch, getCoordinationSummary } from '../controllers/rescue.controller';
import { getSupplies, createSupply, getSupplyDispatches, createSupplyDispatch, updateSupplyTransit } from '../controllers/supply.controller';

const router = Router();
router.use(authenticateToken);
const allOfficers = ['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM'];
const allUsers = [...allOfficers, 'CITIZEN'];
const districtAndDmc = ['DMC_OFFICER', 'DISTRICT_OFFICER'];

// Shelters — citizens can read (for finding shelters map page)
router.get('/shelters/summary', authorizeRoles(...allOfficers), getSheltersSummary);
router.post('/shelters/geocode', authorizeRoles(...districtAndDmc), validateRequest(geocodeShelterSchema), geocodeShelter);
router.post('/shelters', authorizeRoles(...districtAndDmc), validateRequest(createShelterSchema), createShelter);
router.get('/shelters', authorizeRoles(...allUsers), getShelters);
router.get('/shelters/:id', authorizeRoles(...allUsers), getShelter);
router.patch('/shelters/:id/occupancy', authorizeRoles(...districtAndDmc), validateRequest(updateOccupancySchema), updateOccupancy);
router.delete('/shelters/:id', authorizeRoles(...districtAndDmc), deleteShelter);

// Rescue teams
router.get('/rescue-teams', authorizeRoles(...allOfficers), getTeams);
router.post('/dispatches', authorizeRoles(...districtAndDmc), validateRequest(dispatchTeamSchema), dispatchTeam);
router.patch('/dispatches/:id/status', authorizeRoles(...allOfficers), updateDispatch);

// Coordination summary
router.get('/coordination-summary', authorizeRoles(...allOfficers), getCoordinationSummary);

// Supplies
router.get('/supplies', authorizeRoles(...allOfficers), getSupplies);
router.post('/supplies', authorizeRoles(...districtAndDmc), validateRequest(createSupplySchema), createSupply);
router.get('/supply-dispatches', authorizeRoles(...allOfficers), getSupplyDispatches);
router.post('/supply-dispatches', authorizeRoles(...districtAndDmc), validateRequest(createSupplyDispatchSchema), createSupplyDispatch);
router.patch('/supply-dispatches/:id/status', authorizeRoles(...districtAndDmc), validateRequest(updateTransitStatusSchema), updateSupplyTransit);

export default router;
