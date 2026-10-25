"""Fixed educational adapters. Inputs are bounded again at the compute boundary."""
import importlib.metadata, json, math, os, sys
ENGINE=os.environ['ENGINE']
if __name__=='__main__':
    import resource
    for kind,bound in [(resource.RLIMIT_CPU,65),(resource.RLIMIT_AS,1610612736 if ENGINE=='vina' else 805306368),(resource.RLIMIT_FSIZE,4194304),(resource.RLIMIT_NOFILE,64),(resource.RLIMIT_CORE,0)]: resource.setrlimit(kind,(bound,bound))
def n(p,key,low,high,integer=False):
    value=p[key]
    if type(value) not in (int,float) or not math.isfinite(value) or not low<=value<=high or integer and int(value)!=value: raise ValueError(key)
    return value
def output(job,scalars,units,series=None,frames=None,diagnostics=None,**extra):
    packages={'numerics':'scipy','rdkit':'rdkit','cobrapy':'cobra','roadrunner':'libroadrunner','tellurium':'tellurium','copasi':'python-copasi'}
    version=importlib.metadata.version(packages[ENGINE]) if ENGINE in packages else '1.14.2'
    return dict(engine_id=ENGINE,engine_version=version,adapter_version='1.0.0',model_id=job['model_id'],scientific_status='illustrative_educational',scalars=scalars,units=units,series=series or [],frames=frames or [],diagnostics=diagnostics or {},warnings=['Educational model; not an experimentally calibrated biological prediction.'],**extra)
def trajectory(columns,units,data): return dict(columns=columns,units=units,data=data)
def numerics(job):
    import numpy as np
    from scipy.integrate import solve_ivp
    p=job['parameters'];model=job['model_id']
    if model=='cell-energy':
        o=n(p,'oxygen',0,100);g=n(p,'glucose',0,100);d=n(p,'demand',1,100)
        return output(job,{'energy_index':min(100,100*min(o,g)/d)},{'energy_index':'normalized_index_percent'})
    if model=='genetics-lab':
        a,b=p['parent1'],p['parent2'];size=n(p,'sample_size',1,10000,True)
        if a not in ('AA','Aa','aa') or b not in ('AA','Aa','aa'): raise ValueError()
        state=job['seed'];counts={'AA':0,'Aa':0,'aa':0}
        def allele(parent):
            nonlocal state
            state=(1664525*state+1013904223)&0xffffffff
            return parent[int(state/4294967296*2)]
        for _ in range(size): counts[''.join(sorted([allele(a),allele(b)]))]+=1
        return output(job,counts,{key:'offspring' for key in counts},diagnostics={'sampling':'LCG32','sample_size':size})
    if model=='population-dynamics':
        initial=n(p,'initial_population',0,1000);capacity=n(p,'capacity',1,10000);rate=n(p,'growth_rate',0,2);duration=n(p,'duration',.1,100)
        times=np.linspace(0,duration,101);values=np.zeros(101) if initial==0 else capacity/(1+(capacity/initial-1)*np.exp(-rate*times))
        return output(job,{'final_population':float(values[-1])},{'final_population':'individuals'},[trajectory(['time','population'],['min','individuals'],np.column_stack((times,values)).tolist())],diagnostics={'method':'analytic_logistic'})
    if model=='enzyme-explorer':
        initial=n(p,'substrate_mM',0,20);vmax=n(p,'vmax',.01,10);km=n(p,'km_mM',.01,20);duration=n(p,'duration',.1,60)
        def derivative(t,y):
            rate=vmax*max(0,y[0])/(km+max(0,y[0]));return [-rate,rate]
        solution=solve_ivp(derivative,(0,duration),[initial,0],t_eval=np.linspace(0,duration,101),rtol=1e-9,atol=1e-11)
        if not solution.success: raise RuntimeError()
        error=float(np.max(np.abs(solution.y.sum(axis=0)-initial)))
        if error>1e-7 or float(solution.y.min()) < -1e-7: raise RuntimeError()
        return output(job,{'initial_rate':vmax*initial/(km+initial),'final_substrate':float(max(0,solution.y[0,-1])),'final_product':float(solution.y[1,-1])},{'initial_rate':'mM/min','final_substrate':'mM','final_product':'mM'},[trajectory(['time','substrate','product'],['min','mM','mM'],np.column_stack((solution.t,np.maximum(solution.y.T,0))).tolist())],diagnostics={'method':'RK45','rtol':1e-9,'atol':1e-11,'mass_balance_error_mM':error})
    if model=='diffusion-playground':
        diffusivity=n(p,'diffusivity',.0001,.1);size=n(p,'grid_size',8,48,True);steps=n(p,'steps',1,200,True)
        grid=np.zeros((size,size));grid[size//2,size//2]=1;dt=.2/(size*size*diffusivity);frames=[]
        for step in range(steps+1):
            if step%max(1,math.ceil(steps/10))==0 or step==steps: frames.append({'time_min':step*dt,'concentration':grid.tolist(),'unit':'normalized_mass_per_cell'})
            if step<steps:
                padded=np.pad(grid,1,mode='edge');grid+=.2*(padded[2:,1:-1]+padded[:-2,1:-1]+padded[1:-1,2:]+padded[1:-1,:-2]-4*grid)
        error=abs(float(grid.sum())-1)
        if error>1e-8 or grid.min() < -1e-10: raise RuntimeError()
        return output(job,{'mass':float(grid.sum()),'elapsed_time':steps*dt},{'mass':'normalized_mass','elapsed_time':'min'},frames=frames,diagnostics={'method':'explicit_2D_no_flux','stability_coefficient':.2,'mass_error':error,'dx_cm':1/size})
    if model=='ecosystem-rescue':
        nutrients=n(p,'nutrients',0,2);light=n(p,'light',0,1);temperature=n(p,'temperature',5,40);duration=n(p,'duration',1,120)
        def derivative(t,y):
            N,A,O=y;growth=.1*light*max(N,0)/(1+max(N,0))*max(A,0)
            return [nutrients-growth-.02*N,growth-.05*A,.1*(8-O)+.5*growth-.1*A-.01*abs(temperature-20)]
        solution=solve_ivp(derivative,(0,duration),[1,1,8],t_eval=np.linspace(0,duration,101),rtol=1e-8,atol=1e-10)
        if not solution.success: raise RuntimeError()
        return output(job,dict(zip(['nutrients','algae','oxygen'],map(float,solution.y[:,-1]))),{key:'normalized_index' for key in ['nutrients','algae','oxygen']},[trajectory(['time','nutrients','algae','oxygen'],['min','normalized_index','normalized_index','normalized_index'],np.column_stack((solution.t,solution.y.T)).tolist())],diagnostics={'method':'RK45','rtol':1e-8})
    raise ValueError()
def molecule(job):
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
    p=job['parameters'];smiles=p['smiles']
    if p['generate_3d'] not in ('yes','no'): raise ValueError()
    if not isinstance(smiles,str) or not 0<len(smiles)<=256: raise ValueError()
    mol=Chem.MolFromSmiles(smiles)
    if mol is None or mol.GetNumHeavyAtoms()>80 or len(Chem.GetMolFrags(mol))!=1 or any(a.GetAtomicNum() not in (1,6,7,8,9,15,16,17) for a in mol.GetAtoms()): raise ValueError()
    chemistry={'heavy_atom_count':mol.GetNumHeavyAtoms(),'rotatable_bonds':rdMolDescriptors.CalcNumRotatableBonds(mol),'formal_charge':Chem.GetFormalCharge(mol),'radical_electrons':sum(a.GetNumRadicalElectrons() for a in mol.GetAtoms())}
    data={'canonical_smiles':Chem.MolToSmiles(mol),'formula':rdMolDescriptors.CalcMolFormula(mol)}
    if p.get('generate_3d')=='yes':
        mol=Chem.AddHs(mol);params=AllChem.ETKDGv3();params.randomSeed=job['seed'];params.maxIterations=200
        if AllChem.EmbedMolecule(mol,params)!=0: raise ValueError()
        data['molblock']=Chem.MolToMolBlock(mol)
    return output(job,{'molecular_weight':Descriptors.MolWt(mol),'hydrogen_bond_donors':Descriptors.NumHDonors(mol),'hydrogen_bond_acceptors':Descriptors.NumHAcceptors(mol)},{'molecular_weight':'g/mol','hydrogen_bond_donors':'count','hydrogen_bond_acceptors':'count'},molecule=data,diagnostics={'conformer':'ETKDGv3' if 'molblock' in data else 'none','seed':job['seed'],**chemistry})
def metabolic(job):
    from cobra import Model,Reaction,Metabolite
    p=job['parameters'];uptake=n(p,'uptake',0,20);maintenance=n(p,'maintenance',0,10)
    model=Model('educational_resource');resource=Metabolite('resource',compartment='cell')
    source=Reaction('uptake');source.bounds=(0,uptake);source.add_metabolites({resource:1})
    demand=Reaction('maintenance');demand.bounds=(maintenance,100);demand.add_metabolites({resource:-1})
    product=Reaction('product');product.bounds=(0,100);product.add_metabolites({resource:-1})
    model.add_reactions([source,demand,product]);model.objective=product;solution=model.optimize()
    feasible=solution.status=='optimal'
    return output(job,{'feasible':int(feasible),**({'product_flux':float(solution.objective_value)} if feasible else {})},{'feasible':'boolean','product_flux':'normalized_flux_units'},diagnostics={'solver_status':solution.status,'solver':'glpk','network':'curated_toy_resource_balance'})
def pathway_sbml(graph):
    import re
    if not isinstance(graph,dict) or set(graph)!={'name','species','reactions'} or not 1<=len(graph['species'])<=24 or not 1<=len(graph['reactions'])<=32: raise ValueError()
    ids=set();species=[]
    for s in graph['species']:
        if set(s)!={'id','initial_mM'} or not re.fullmatch(r'S[0-9]{1,3}',s['id']) or s['id'] in ids: raise ValueError()
        initial=n(s,'initial_mM',0,100);ids.add(s['id']);species.append(f'<species id="{s["id"]}" compartment="cell" initialConcentration="{initial}" substanceUnits="substance" boundaryCondition="false" constant="false" hasOnlySubstanceUnits="false"/>')
    definitions=['<unitDefinition id="substance"><listOfUnits><unit kind="mole" scale="-3" multiplier="1" exponent="1"/></listOfUnits></unitDefinition>','<unitDefinition id="time"><listOfUnits><unit kind="second" multiplier="60" exponent="1"/></listOfUnits></unitDefinition>']
    parameters=[];reactions=[];seen=set()
    for i,r in enumerate(graph['reactions']):
        if set(r)!={'id','reactants','products','rate_constant'} or not re.fullmatch(r'R[0-9]{1,3}',r['id']) or r['id'] in seen: raise ValueError()
        seen.add(r['id']);rate=n(r,'rate_constant',0,10);sides={}
        for label in ('reactants','products'):
            if len(r[label])>4 or len({x['species'] for x in r[label]})!=len(r[label]): raise ValueError()
            for x in r[label]:
                if set(x)!={'species','stoichiometry'} or x['species'] not in ids: raise ValueError()
                n(x,'stoichiometry',1,4,True)
            cap=label.capitalize();sides[label]=f'<listOf{cap}>'+''.join(f'<speciesReference species="{x["species"]}" stoichiometry="{x["stoichiometry"]}"/>' for x in r[label])+f'</listOf{cap}>' if r[label] else ''
        order=sum(x['stoichiometry'] for x in r['reactants'])
        if order>4 or not r['reactants'] and not r['products']: raise ValueError()
        definitions.append(f'<unitDefinition id="rate{i}"><listOfUnits><unit kind="mole" scale="-3" exponent="{1-order}"/><unit kind="litre" exponent="{order-1}"/><unit kind="second" multiplier="60" exponent="-1"/></listOfUnits></unitDefinition>')
        parameters.append(f'<parameter id="k{i}" value="{rate}" units="rate{i}" constant="true"/>')
        terms=[f'<ci>k{i}</ci>','<ci>cell</ci>']+[f'<ci>{x["species"]}</ci>' if x['stoichiometry']==1 else f'<apply><power/><ci>{x["species"]}</ci><cn>{x["stoichiometry"]}</cn></apply>' for x in r['reactants']]
        reactions.append(f'<reaction id="{r["id"]}" reversible="false">{sides["reactants"]}{sides["products"]}<kineticLaw><math xmlns="http://www.w3.org/1998/Math/MathML"><apply><times/>'+''.join(terms)+'</apply></math></kineticLaw></reaction>')
    return '<?xml version="1.0"?><sbml xmlns="http://www.sbml.org/sbml/level2/version4" level="2" version="4"><model id="educational_pathway"><listOfUnitDefinitions>'+''.join(definitions)+'</listOfUnitDefinitions><listOfCompartments><compartment id="cell" size="1" units="litre" constant="true"/></listOfCompartments><listOfSpecies>'+''.join(species)+'</listOfSpecies><listOfParameters>'+''.join(parameters)+'</listOfParameters><listOfReactions>'+''.join(reactions)+'</listOfReactions></model></sbml>'
def kinetics(job):
    graph=job['input']['pathway'];sbml=pathway_sbml(graph);duration=n(job['parameters'],'duration',.1,60);ids=[s['id'] for s in graph['species']]
    if ENGINE in ('roadrunner','tellurium'):
        if ENGINE=='roadrunner':
            import roadrunner
            model=roadrunner.RoadRunner(sbml)
        else:
            import tellurium
            model=tellurium.loadSBMLModel(sbml)
        model.timeCourseSelections=['time']+['['+sid+']' for sid in ids]
        data=model.simulate(0,duration,101).tolist()
    else:
        import COPASI
        model=COPASI.CRootContainer.addDatamodel()
        if not model.importSBMLFromString(sbml): raise ValueError()
        task=model.getTask('Time-Course');problem=task.getProblem();problem.setDuration(duration);problem.setStepNumber(100);problem.setTimeSeriesRequested(True)
        if not task.process(True): raise RuntimeError()
        series=task.getTimeSeries();mapping={series.getSBMLId(i,model):i for i in range(1,series.getNumVariables())}
        data=[[series.getData(row,0)]+[series.getConcentrationData(row,mapping[sid]) for sid in ids] for row in range(series.getRecordedSteps())]
    if not data or len(data)>102 or any(not math.isfinite(v) or abs(v)>1e6 for row in data for v in row) or any(v < -1e-5 for row in data for v in row[1:]): raise RuntimeError()
    return output(job,dict(zip(ids,data[-1][1:])),{sid:'mM' for sid in ids},[trajectory(['time']+ids,['min']+['mM']*len(ids),data)],network={'graph':graph,'sbml':sbml},diagnostics={'method':'native_time_course','rate_units':'mM^(1-reaction_order)/min'})
def colony(job):
    import pathlib,struct,subprocess,xml.etree.ElementTree as ET
    p=job['parameters'];duration=n(p,'duration',.1,30);initial=n(p,'initial_cells',1,20,True)
    tree=ET.parse('/opt/physicell/config/PhysiCell_settings.xml');root=tree.getroot()
    settings={'domain/x_min':-100,'domain/x_max':100,'domain/y_min':-100,'domain/y_max':100,'overall/max_time':duration,'parallel/omp_num_threads':1,'save/folder':'output','save/full_data/interval':duration/4,'save/SVG/enable':'false','options/random_seed':job['seed'],'user_parameters/number_of_cells':initial}
    for key,value in settings.items():
        element=root.find(key)
        if element is None: raise RuntimeError()
        element.text=str(value)
    pathlib.Path('output').mkdir();tree.write('settings.xml')
    with open('native.log','wb') as log: subprocess.run(['/opt/physicell/project','settings.xml'],stdout=log,stderr=log,timeout=max(.1,job['timeout_seconds']-1),check=True)
    frames=[];times=[]
    for filename in sorted(pathlib.Path('output').glob('output*_cells.mat')):
        if len(frames)>=21 or filename.stat().st_size>4194304: raise RuntimeError()
        with filename.open('rb') as stream:
            kind,rows,columns,imaginary,name_size=struct.unpack('<5i',stream.read(20))
            if kind!=0 or not 1<=rows<=500 or not 0<=columns<=1000 or imaginary or not 1<=name_size<=1024: raise RuntimeError()
            stream.read(name_size);raw=stream.read(rows*columns*8)
            values=struct.unpack('<'+'d'*(rows*columns),raw)
        xml=ET.parse(str(filename).replace('_cells.mat','.xml'));labels=xml.findall('.//simplified_data/labels/label');positions={x.text:int(x.attrib['index']) for x in labels}
        position=positions.get('position',1);volume=positions.get('total_volume',4);cells=[]
        for i in range(columns):
            cell=values[i*rows:(i+1)*rows]
            if not all(math.isfinite(v) for v in cell): raise RuntimeError()
            cells.append({'id':int(cell[0]),'position_um':list(cell[position:position+3]),'volume_um3':cell[volume]})
        time_value=float(xml.findtext('.//current_time'));times.append([time_value,columns]);frames.append({'time_min':time_value,'cells':cells})
    if not frames: raise RuntimeError()
    return output(job,{'cell_count':len(frames[-1]['cells'])},{'cell_count':'cells'},[trajectory(['time','cell_count'],['min','cells'],times)],frames=frames,diagnostics={'source_commit':'dbd3499250141b27600e91e501c54c46f68f2763','template':'upstream_generic','threads':1,'dimensions':2})

def main(job):
    if ENGINE=='vina':
        from docking.execute_docking import dock
        return dock(job)
    if ENGINE=='numerics': return numerics(job)
    if ENGINE=='rdkit': return molecule(job)
    if ENGINE=='cobrapy': return metabolic(job)
    if ENGINE in ('roadrunner','tellurium','copasi'): return kinetics(job)
    if ENGINE=='physicell': return colony(job)
    raise ValueError()
if __name__=='__main__':
    try:
        job=json.loads(sys.stdin.buffer.read(65537));result=main(job);sys.stdout.write(json.dumps(result,allow_nan=False))
    except (ValueError,KeyError,TypeError): sys.exit(2)
    except Exception: sys.exit(1)
