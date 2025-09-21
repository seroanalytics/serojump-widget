# SeroJump WebAssembly Widget

Interactive web application for simulating individual antibody trajectories and fitting them using serojump-style reversible-jump MCMC.

## Features

- **Individual Trajectory Simulation**: Simulate 10 individuals with mixed infection histories
- **Antibody Kinetics**: Model IgG titre dynamics with infection events
- **Real-time RJ-MCMC**: Bayesian inference for infection probabilities
- **Interactive Visualization**: Real-time parameter traces and trajectory plots
- **WebAssembly Performance**: High-speed C++ core compiled to WASM

## Architecture

### Data Model
```cpp
struct Individual {
    int id;
    vector<double> sample_times;     // when samples were taken
    vector<double> titre_values;     // observed IgG titres
    vector<double> infection_times;  // true infection times (for simulation)
    double infection_prob;           // fitted infection probability
};
```

### Antibody Kinetics
- **Pre-infection**: Baseline titre with noise
- **Post-infection**: Exponential rise then decay
- **Function**: `titre = baseline + boost * exp(-decay * (t - t_inf))` for t > t_inf

### RJ-MCMC Components
1. **Parameter updates**: baseline titre, boost, decay, noise
2. **Infection time updates**: continuous time proposals  
3. **Model selection**: infected vs uninfected states
4. **Acceptance criteria**: Metropolis-Hastings with jacobians

## Quick Start

```bash
./build.sh
./start.sh
```

Visit http://localhost:2020 to use the widget.
