"""Reference checks run inside the real engine containers."""
import json, math, os, urllib.request, uuid
engine=os.environ['ENGINE']
def run(model,parameters,input=None):
    payload=dict(job_id=str(uuid.uuid4()),model_id=model,parameters=parameters,seed=42,input=input or {},timeout_seconds=30)
    request=urllib.request.Request('http://127.0.0.1:8080/v1/execute',json.dumps(payload).encode(),{'Content-Type':'application/json','Authorization':'Bearer '+os.environ['SCIENCE_TOKEN']})
    with urllib.request.urlopen(request,timeout=40) as response: return json.load(response)
def close(actual,expected,tolerance=1e-5): assert abs(actual-expected)<=tolerance,(actual,expected)
if engine=='numerics':
    close(run('cell-energy',dict(oxygen=30,glucose=60,demand=50))['scalars']['energy_index'],60)
    enzyme=run('enzyme-explorer',dict(substrate_mM=2,vmax=1,km_mM=2,duration=10));close(enzyme['scalars']['initial_rate'],.5);close(enzyme['scalars']['final_substrate']+enzyme['scalars']['final_product'],2)
    population=run('population-dynamics',dict(initial_population=100,capacity=1000,growth_rate=.2,duration=20));close(population['scalars']['final_population'],1000/(1+9*math.exp(-4)))
    genetics=run('genetics-lab',dict(parent1='AA',parent2='aa',sample_size=100));assert genetics['scalars']==dict(AA=0,Aa=100,aa=0)
    close(run('diffusion-playground',dict(diffusivity=.01,grid_size=16,steps=50))['scalars']['mass'],1)
    assert len(run('ecosystem-rescue',dict(nutrients=.2,light=.5,temperature=20,duration=60))['series'][0]['data'])==101
elif engine in ('roadrunner','tellurium','copasi'):
    graph=dict(name='First order conversion',species=[dict(id='S0',initial_mM=2),dict(id='S1',initial_mM=0)],reactions=[dict(id='R0',reactants=[dict(species='S0',stoichiometry=1)],products=[dict(species='S1',stoichiometry=1)],rate_constant=.2)])
    result=run('pathway-playground',dict(duration=10),dict(pathway=graph));close(result['scalars']['S0'],2*math.exp(-2),1e-4);close(sum(result['scalars'].values()),2,1e-4)
elif engine=='rdkit':
    result=run('molecule-sketchbook',dict(smiles='CCO',generate_3d='yes'));close(result['scalars']['molecular_weight'],46.069,.01);assert result['molecule']['formula']=='C2H6O';assert 'molblock' in result['molecule']
elif engine=='cobrapy':
    result=run('metabolism-explorer',dict(uptake=10,maintenance=2));close(result['scalars']['product_flux'],8)
    assert run('metabolism-explorer',dict(uptake=1,maintenance=2))['scalars']['feasible']==0
elif engine=='physicell':
    result=run('cell-colony',dict(duration=.1,initial_cells=5));assert result['scalars']['cell_count']==5;assert len(result['frames'])>=2
print(json.dumps(dict(engine=engine,reference_checks='passed')))
