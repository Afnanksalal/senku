"""Dependency/solver smoke checks; these do not validate Senku scientific models."""
import math
import os
import subprocess

engine = os.environ['ENGINE']
if engine == 'numerics':
    from scipy.integrate import solve_ivp
    result = solve_ivp(lambda t, y: -y, (0, 1), [1], rtol=1e-9, atol=1e-11)
    assert result.success and abs(result.y[0, -1] - math.exp(-1)) < 1e-7
elif engine == 'rdkit':
    from rdkit import Chem
    from rdkit.Chem import AllChem
    molecule = Chem.AddHs(Chem.MolFromSmiles('CCO'))
    assert AllChem.EmbedMolecule(molecule, randomSeed=42) == 0
    assert molecule.GetNumConformers() == 1
elif engine == 'cobrapy':
    from cobra import Model, Reaction, Metabolite
    model = Model('bootstrap_toy')
    metabolite = Metabolite('a')
    source, sink = Reaction('source'), Reaction('sink')
    source.bounds = (0, 10)
    source.add_metabolites({metabolite: 1})
    sink.bounds = (0, 1000)
    sink.add_metabolites({metabolite: -1})
    model.add_reactions([source, sink])
    model.objective = sink
    result = model.optimize()
    assert result.status == 'optimal' and abs(result.objective_value - 10) < 1e-7
elif engine == 'roadrunner':
    import roadrunner
    model = roadrunner.RoadRunner('''<sbml xmlns="http://www.sbml.org/sbml/level2/version4" level="2" version="4"><model id="toy"><listOfCompartments><compartment id="cell" size="1"/></listOfCompartments><listOfSpecies><species id="S1" compartment="cell" initialConcentration="1"/></listOfSpecies><listOfParameters><parameter id="k" value="1"/></listOfParameters><listOfReactions><reaction id="decay" reversible="false"><listOfReactants><speciesReference species="S1" stoichiometry="1"/></listOfReactants><kineticLaw><math xmlns="http://www.w3.org/1998/Math/MathML"><apply><times/><ci>k</ci><ci>S1</ci><ci>cell</ci></apply></math></kineticLaw></reaction></listOfReactions></model></sbml>''')
    result = model.simulate(0, 1, 11)
    assert abs(float(result[-1, 1]) - math.exp(-1)) < 1e-4
elif engine == 'tellurium':
    import tellurium as te
    model = te.loada('J0: S1 -> S2; k*S1; S1=1; S2=0; k=1;')
    result = model.simulate(0, 1, 11)
    assert abs(float(result[-1, 1]) - math.exp(-1)) < 1e-4
elif engine == 'copasi':
    import COPASI
    data_model = COPASI.CRootContainer.addDatamodel()
    assert data_model.getModel() is not None
elif engine == 'biosimulators':
    from biosimulators_utils.sedml.data_model import SedDocument
    assert SedDocument() is not None
elif engine == 'physicell':
    result = subprocess.run(['ldd', '/opt/physicell/project'], capture_output=True, text=True, check=True)
    assert 'not found' not in result.stdout
else:
    raise RuntimeError('Unexpected engine')
print(f'PASS: {engine} dependency smoke check')
