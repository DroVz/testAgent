import type { Exercise, MuscleGroup } from './types';

const ex = (id: string, name: string, muscleGroup: MuscleGroup): Exercise => ({
  id,
  name,
  muscleGroup,
  isCustom: false,
});

/** Bibliothèque pré-remplie. Les ids sont stables : ne pas les modifier. */
export const DEFAULT_EXERCISES: readonly Exercise[] = [
  // Pectoraux
  ex('developpe-couche', 'Développé couché', 'Pectoraux'),
  ex('developpe-incline', 'Développé incliné', 'Pectoraux'),
  ex('developpe-couche-halteres', 'Développé couché haltères', 'Pectoraux'),
  ex('ecarte-halteres', 'Écarté haltères', 'Pectoraux'),
  ex('pompes', 'Pompes', 'Pectoraux'),
  ex('dips', 'Dips', 'Pectoraux'),
  // Dos
  ex('souleve-de-terre', 'Soulevé de terre', 'Dos'),
  ex('tractions', 'Tractions', 'Dos'),
  ex('rowing-barre', 'Rowing barre', 'Dos'),
  ex('rowing-haltere', 'Rowing haltère', 'Dos'),
  ex('tirage-vertical', 'Tirage vertical', 'Dos'),
  ex('tirage-horizontal', 'Tirage horizontal', 'Dos'),
  // Jambes
  ex('squat', 'Squat', 'Jambes'),
  ex('presse-a-cuisses', 'Presse à cuisses', 'Jambes'),
  ex('fentes', 'Fentes', 'Jambes'),
  ex('souleve-de-terre-roumain', 'Soulevé de terre roumain', 'Jambes'),
  ex('leg-extension', 'Leg extension', 'Jambes'),
  ex('leg-curl', 'Leg curl', 'Jambes'),
  ex('mollets-debout', 'Mollets debout', 'Jambes'),
  ex('hip-thrust', 'Hip thrust', 'Jambes'),
  // Épaules
  ex('developpe-militaire', 'Développé militaire', 'Épaules'),
  ex('developpe-epaules-halteres', 'Développé épaules haltères', 'Épaules'),
  ex('elevations-laterales', 'Élévations latérales', 'Épaules'),
  ex('oiseau', 'Oiseau', 'Épaules'),
  // Biceps
  ex('curl-barre', 'Curl barre', 'Biceps'),
  ex('curl-halteres', 'Curl haltères', 'Biceps'),
  ex('curl-marteau', 'Curl marteau', 'Biceps'),
  // Triceps
  ex('barre-au-front', 'Barre au front', 'Triceps'),
  ex('extension-triceps-poulie', 'Extension triceps poulie', 'Triceps'),
  // Abdos
  ex('crunch', 'Crunch', 'Abdos'),
  ex('gainage', 'Gainage', 'Abdos'),
  ex('releve-de-jambes', 'Relevé de jambes', 'Abdos'),
];
