import { experimentSchema } from '@senku/experiment-schema';

/** Public teaching choices only. Arbitrary receptors, targets and boxes are not accepted. */
export const dockingTargets = [
  {
    id: 'trypsin', name: 'Trypsin', organism: 'Bos taurus', pdb_id: '3PTB',
    description: 'Explore a small binding pocket in a bovine digestive enzyme.',
    reference_ligand: 'Benzamidine', reference_smiles: 'NC(=N)c1ccccc1',
    source_url: 'https://www.rcsb.org/structure/3PTB',
  },
  {
    id: 'streptavidin', name: 'Streptavidin', organism: 'Streptomyces avidinii', pdb_id: '1STP',
    description: 'Compare shapes in the biotin-binding pocket of a benign teaching protein.',
    reference_ligand: 'Biotin', reference_smiles: 'C1[C@H]2[C@@H]([C@@H](S1)CCCCC(=O)O)NC(=O)N2',
    source_url: 'https://www.rcsb.org/structure/1STP',
  },
] as const;
export const dockingLimitations = [
  'Docking scores are estimates, not measured binding strengths. They do not establish biological activity or safety.',
  'The protein is treated as rigid. Protein motion, solvent and many biological effects are not modeled.',
  'A more negative score ranks a pose within this search; scores are not a reliable cross-protein comparison.',
  'The search area is fixed around the known bound molecule. A search may return fewer poses than requested.',
];
export const dockingExperiment = experimentSchema.parse({
  schema_version:'1.0.0', id:'molecular-docking', version:'1.0.0', subject:'biology',
  name:'Molecular Match', description:'Explore how a small molecule might fit into a known protein pocket, then compare predicted poses with a crystal reference.',
  model:{id:'teaching-docking',version:'1.0.0',scientific_status:'illustrative_educational',
    equations:['Search bounded ligand translations, rotations and torsions in a fixed binding-site box; rank poses by an empirical scoring function.'],
    assumptions:['Curated nonpathogen, nontoxin teaching proteins only.','Fixed prepared receptor and known binding site.','The protein is rigid. Seeded search uses one CPU.'],
    limitations:dockingLimitations,
    references:[
      {id:'vina-method',title:'AutoDock Vina: improving the speed and accuracy of docking',url:'https://doi.org/10.1002/jcc.21334'},
      {id:'trypsin-structure',title:'Bovine trypsin in complex with benzamidine, PDB 3PTB',url:'https://www.rcsb.org/structure/3PTB'},
      {id:'streptavidin-structure',title:'Streptavidin complexed with biotin, PDB 1STP',url:'https://www.rcsb.org/structure/1STP'},
    ]},
  engine:{id:'vina',adapter_version:'1.0.0',timeout_seconds:60},
  parameters:{
    target:{type:'enum',unit:'dimensionless',values:['trypsin','streptavidin'],default:'trypsin'},
    smiles:{type:'text',unit:'SMILES',max_length:160,default:'NC(=N)c1ccccc1'},
    exhaustiveness:{type:'number',unit:'search_effort',min:1,max:8,default:2,integer:true},
    num_modes:{type:'number',unit:'poses',min:1,max:5,default:3,integer:true},
    seed:{type:'number',unit:'dimensionless',min:1,max:2147483647,default:42,integer:true},
  },
  outputs:[{id:'poses',type:'molecule',unit:'angstrom'},{id:'scores',type:'table',unit:'kcal/mol'}],
  learning:{objective:'Compare computed poses with a known bound molecule and explain the limits of rigid-protein docking.',concept:'molecular-recognition'},
  modes:['lab','discover'],local_capable:false,safety:{class:'approved_educational',user_code:false},
});
