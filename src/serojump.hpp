#pragma once
#include <vector>
#include <random>
#include <cmath>
#include <array>
#include <memory>
#include <algorithm>

// Individual antibody trajectory data structure
struct Individual {
    int id;
    std::vector<double> sample_times;      // times when samples were taken
    std::vector<double> titre_values;      // observed IgG titre values
    std::vector<double> true_infection_times; // true infection times (for simulation)
    bool is_infected;                      // true infection status
    double infection_prob;                 // fitted probability of infection
    double baseline_titre;                 // baseline antibody level
};

// Parameters for antibody kinetics model
struct AntibodyParams {
    double baseline_mean;     // mean baseline titre
    double baseline_sd;       // baseline titre variability
    double boost_mean;        // mean titre boost from infection  
    double boost_sd;          // boost variability
    double decay_rate;        // antibody decay rate post-infection
    double observation_sd;    // measurement noise
};

// MCMC parameters for an individual
struct IndividualMCMC {
    double baseline;          // individual baseline titre
    double boost;            // titre boost from infection
    double infection_time;   // proposed infection time
    bool infected_state;     // current infection state
    double log_likelihood;   // current log-likelihood
    double infection_prob_prior; // prior probability of infection
};

// Study-wide parameters  
struct StudyParams {
    double study_start;      // study start time
    double study_end;        // study end time
    int n_individuals;       // number of individuals
    double infection_rate;   // population infection rate
    std::vector<double> infection_hazard; // time-varying infection hazard
};

class SeroJumpSimulator {
private:
    std::mt19937 rng;
    std::normal_distribution<double> normal_dist;
    std::uniform_real_distribution<double> uniform_dist;
    
    // Antibody kinetics function
    double computeTitre(double baseline, double boost, double decay_rate, 
                       double infection_time, double sample_time);
    
    // Log-likelihood calculation
    double logLikelihood(const Individual& individual, const IndividualMCMC& params,
                        const AntibodyParams& study_params);
    
    // Prior probabilities
    double logPriorBaseline(double baseline, const AntibodyParams& params);
    double logPriorBoost(double boost, const AntibodyParams& params);  
    double logPriorInfection(bool infected, double infection_time, 
                           const StudyParams& study_params);

public:
    SeroJumpSimulator(unsigned seed = 12345);
    
    // Simulation methods
    std::vector<Individual> simulateStudy(const StudyParams& study_params,
                                         const AntibodyParams& ab_params,
                                         int n_samples_per_individual);
    
    Individual simulateIndividual(int id, const StudyParams& study_params,
                                 const AntibodyParams& ab_params,
                                 int n_samples);
    
    // MCMC methods
    struct MCMCStep {
        IndividualMCMC params;
        bool accepted;
        double acceptance_rate;
    };
    
    MCMCStep mcmcStepIndividual(const Individual& individual,
                               const IndividualMCMC& current_params,
                               const AntibodyParams& study_params,
                               const StudyParams& study_settings);
    
    // Parameter proposal methods
    IndividualMCMC proposeParameters(const IndividualMCMC& current,
                                   double baseline_step, double boost_step);
    
    IndividualMCMC proposeInfectionTime(const IndividualMCMC& current,
                                       const StudyParams& study_params);
    
    IndividualMCMC proposeInfectionState(const IndividualMCMC& current);
    
    // Full MCMC chain for multiple individuals
    struct MCMCResults {
        std::vector<std::vector<IndividualMCMC>> chains; // [individual][step]
        std::vector<double> acceptance_rates;
        int total_steps;
        int burnin_steps;
    };
    
    MCMCResults runMCMCStudy(const std::vector<Individual>& individuals,
                           const AntibodyParams& ab_params,
                           const StudyParams& study_params,
                           int n_steps, int burnin);
};

// C interface for Emscripten
extern "C" {
    // Simulator management
    SeroJumpSimulator* create_serojump_simulator(unsigned seed);
    void destroy_serojump_simulator(SeroJumpSimulator* simulator);
    
    // Study simulation
    int simulate_study(SeroJumpSimulator* simulator,
                      double study_start, double study_end, int n_individuals,
                      double infection_rate, int n_samples_per_individual,
                      double baseline_mean, double baseline_sd,
                      double boost_mean, double boost_sd, 
                      double decay_rate, double observation_sd,
                      // Output arrays (pre-allocated)
                      int* individual_ids, double* sample_times, double* titre_values,
                      double* true_infection_times, int* infection_status,
                      int* out_total_samples);
    
    // Individual MCMC step
    int mcmc_step_individual(SeroJumpSimulator* simulator,
                           // Individual data
                           int individual_id, double* sample_times, double* titre_values, int n_samples,
                           // Current MCMC state
                           double current_baseline, double current_boost, double current_infection_time,
                           int current_infected_state, double current_log_likelihood,
                           // Study parameters
                           double study_start, double study_end, double infection_rate,
                           double baseline_mean, double baseline_sd, double boost_mean, double boost_sd,
                           double decay_rate, double observation_sd,
                           // Proposal parameters
                           double baseline_step, double boost_step,
                           // Output
                           double* new_baseline, double* new_boost, double* new_infection_time,
                           int* new_infected_state, double* new_log_likelihood,
                           int* accepted, double* acceptance_rate);
    
    // Run full MCMC for study
    int run_mcmc_study(SeroJumpSimulator* simulator,
                      // Study data
                      int n_individuals, int* individual_ids, 
                      double* sample_times_all, double* titre_values_all, 
                      int* n_samples_per_individual,
                      // MCMC settings
                      int n_steps, int burnin,
                      // Study parameters  
                      double study_start, double study_end, double infection_rate,
                      double baseline_mean, double baseline_sd, double boost_mean, double boost_sd,
                      double decay_rate, double observation_sd,
                      // Output (pre-allocated)
                      double* baseline_chains, double* boost_chains, double* infection_time_chains,
                      int* infected_state_chains, double* log_likelihood_chains,
                      double* acceptance_rates);
    
    // Utility functions
    double compute_titre(double baseline, double boost, double decay_rate,
                        double infection_time, double sample_time);
    
    double compute_log_likelihood(int individual_id, double* sample_times, double* titre_values, int n_samples,
                                 double baseline, double boost, double decay_rate,
                                 double infection_time, int infected_state, double observation_sd);
}
