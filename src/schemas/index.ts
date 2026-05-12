import { z } from 'zod';

// ─────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────
//  MISSION
// ─────────────────────────────────────────

export const missionSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  client: z.string().min(1, 'Le client est requis'),
  apporteur: z.string(),
  statut: z.enum(['prospect', 'tdr', 'propale', 'contrat', 'en_cours', 'termine', 'perdu']),
  montant: z.number().min(0, 'Doit être positif'),
  avance: z.number().min(0, 'Doit être positif'),
  debut: z.string(),
  fin: z.string(),
  tva: z.enum(['exo', '18']),
  nature: z.enum(['prevu', 'imprevu']),
  desc: z.string(),
}).refine(
  d => !d.avance || !d.montant || d.avance <= d.montant,
  { message: "L'avance ne peut pas dépasser le montant", path: ['avance'] }
);

export type MissionInput = z.infer<typeof missionSchema>;

// ─────────────────────────────────────────
//  STAFF
// ─────────────────────────────────────────

export const staffSchema = z.object({
  nom: z.string().min(2, 'Minimum 2 caractères'),
  poste: z.string(),
  sal: z.number().min(0, 'Doit être positif'),
  nature: z.enum(['Consultant', 'CDI', 'CDD', 'Stage']),
  debut: z.string(),
  fin: z.string(),
  marabu: z.boolean(),
  actif: z.boolean(),
});

export type StaffInput = z.infer<typeof staffSchema>;

// ─────────────────────────────────────────
//  CHARGE
// ─────────────────────────────────────────

export const chargeSchema = z.object({
  lib: z.string().min(1, 'Le libellé est requis'),
  cat: z.enum(['RH', 'EXPLOIT', 'UTIL', 'VAR'], { error: 'Catégorie invalide' }),
  nature: z.enum(['fixe', 'variable']),
  type: z.enum(['prevu', 'imprevu']),
  per: z.string().min(1, 'La périodicité est requise'),
  budget: z.number().min(0, 'Doit être positif'),
  obs: z.string(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;

// ─────────────────────────────────────────
//  DÉPENSE BANQUE
// ─────────────────────────────────────────

export const depenseSchema = z.object({
  type: z.enum(['ENTREE BANQUE', 'SORTIE BANQUE'], { error: 'Type invalide' }),
  cat: z.string(),
  per: z.string(),
  int: z.string(),
  date: z.string().min(1, 'La date est requise'),
  des: z.string().min(1, 'La désignation est requise'),
  prest: z.string(),
  mnt: z.number().min(0),
  ft: z.number().min(0),
  pen: z.number().min(0),
  ref: z.string(),
  nature: z.enum(['prevu', 'imprevu']),
});

export type DepenseInput = z.infer<typeof depenseSchema>;

// ─────────────────────────────────────────
//  PETITE CAISSE
// ─────────────────────────────────────────

export const petiteCaisseSchema = z.object({
  caisse: z.enum(['PRINCIPALE', 'BEN SOUDA'], { error: 'Caisse invalide' }),
  type: z.enum(['entree', 'sortie'], { error: 'Type invalide' }),
  cat: z.string(),
  nature: z.enum(['prevu', 'imprevu']),
  per: z.string(),
  date: z.string().min(1, 'La date est requise'),
  des: z.string().min(1, 'La désignation est requise'),
  prest: z.string(),
  entree: z.number().min(0),
  sortie: z.number().min(0),
  pen: z.number().min(0),
}).refine(
  d => d.entree > 0 || d.sortie > 0,
  { message: 'Entrez un montant entrée ou sortie', path: ['entree'] }
);

export type PetiteCaisseInput = z.infer<typeof petiteCaisseSchema>;

// ─────────────────────────────────────────
//  PARAMÈTRES
// ─────────────────────────────────────────

export const paramsSchema = z.object({
  banque: z.number().min(0),
  coffre: z.number().min(0),
  masse_sal: z.number().min(0),
  charges_pat: z.number().min(0),
  primes_mens: z.number().min(0),
  arr_sal: z.number().min(0),
  arr_sal_r: z.number().min(0),
  arr_sal_m: z.number().min(0),
  arr_prim: z.number().min(0),
  arr_prim_m: z.number().min(0),
}).refine(
  d => d.arr_sal_r <= d.arr_sal,
  { message: 'Le remboursé ne peut pas dépasser le total dû', path: ['arr_sal_r'] }
);

export type ParamsInput = z.infer<typeof paramsSchema>;
