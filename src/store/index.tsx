import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { initialDB } from '../data/db';
import type { DB, Mission, Staff, Charge, Depense, PetiteCaisse, Facture } from '../types';

type Action =
  | { type: 'ADD_MISSION'; payload: Mission }
  | { type: 'UPDATE_MISSION'; payload: Mission }
  | { type: 'DELETE_MISSION'; id: number }
  | { type: 'ADD_STAFF'; payload: Staff }
  | { type: 'UPDATE_STAFF'; payload: Staff }
  | { type: 'DELETE_STAFF'; id: number }
  | { type: 'ADD_CHARGE'; payload: Charge }
  | { type: 'UPDATE_CHARGE'; payload: Charge }
  | { type: 'DELETE_CHARGE'; id: number }
  | { type: 'ADD_DEPENSE'; payload: Depense }
  | { type: 'UPDATE_DEPENSE'; payload: Depense }
  | { type: 'DELETE_DEPENSE'; id: number }
  | { type: 'ADD_PC'; payload: PetiteCaisse }
  | { type: 'DELETE_PC'; id: number }
  | { type: 'ADD_FACTURE'; payload: Facture }
  | { type: 'UPDATE_PARAMS'; payload: Partial<DB['params']> }
  | { type: 'UPDATE_TRES_ROW'; idx: number; payload: Partial<DB['tresorerie'][0]> };

function reducer(state: DB, action: Action): DB {
  switch (action.type) {
    case 'ADD_MISSION':
      return { ...state, missions: [...state.missions, action.payload], nextId: { ...state.nextId, mission: state.nextId.mission + 1 } };
    case 'UPDATE_MISSION':
      return { ...state, missions: state.missions.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MISSION':
      return { ...state, missions: state.missions.filter(m => m.id !== action.id) };
    case 'ADD_STAFF':
      return { ...state, staff: [...state.staff, action.payload], nextId: { ...state.nextId, staff: state.nextId.staff + 1 } };
    case 'UPDATE_STAFF':
      return { ...state, staff: state.staff.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_STAFF':
      return { ...state, staff: state.staff.filter(s => s.id !== action.id) };
    case 'ADD_CHARGE':
      return { ...state, charges: [...state.charges, action.payload], nextId: { ...state.nextId, charge: state.nextId.charge + 1 } };
    case 'UPDATE_CHARGE':
      return { ...state, charges: state.charges.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CHARGE':
      return { ...state, charges: state.charges.filter(c => c.id !== action.id) };
    case 'ADD_DEPENSE':
      return { ...state, depenses: [...state.depenses, action.payload], nextId: { ...state.nextId, dep: state.nextId.dep + 1 } };
    case 'UPDATE_DEPENSE':
      return { ...state, depenses: state.depenses.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DEPENSE':
      return { ...state, depenses: state.depenses.filter(d => d.id !== action.id) };
    case 'ADD_PC':
      return { ...state, petite_caisse: [...state.petite_caisse, action.payload], nextId: { ...state.nextId, pc: state.nextId.pc + 1 } };
    case 'DELETE_PC':
      return { ...state, petite_caisse: state.petite_caisse.filter(p => p.id !== action.id) };
    case 'ADD_FACTURE':
      return { ...state, factures: [...state.factures, action.payload], nextId: { ...state.nextId, facture: state.nextId.facture + 1 } };
    case 'UPDATE_PARAMS':
      return { ...state, params: { ...state.params, ...action.payload } };
    case 'UPDATE_TRES_ROW':
      return { ...state, tresorerie: state.tresorerie.map((r, i) => i === action.idx ? { ...r, ...action.payload } : r) };
    default:
      return state;
  }
}

const DBContext = createContext<{ db: DB; dispatch: React.Dispatch<Action> } | null>(null);

export function DBProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, initialDB);
  return <DBContext.Provider value={{ db, dispatch }}>{children}</DBContext.Provider>;
}

export function useDB() {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used within DBProvider');
  return ctx;
}
