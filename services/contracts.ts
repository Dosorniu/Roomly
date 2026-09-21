import type {
  University,
  Campus,
  Building,
  Floor,
  Room,
  User,
} from "../types/domain";
// Future adapters must enforce authorization server-side. These contracts are not a fake admin implementation.
export interface AuthService {
  currentUser(): Promise<User | null>;
  signOut(): Promise<void>;
}
export interface AdminCatalogRepository {
  saveUniversity(value: University): Promise<void>;
  saveCampus(value: Campus): Promise<void>;
  saveBuilding(value: Building): Promise<void>;
  saveFloor(value: Floor): Promise<void>;
  saveRoom(value: Room): Promise<void>;
  disableRoom(roomId: string): Promise<void>;
}
