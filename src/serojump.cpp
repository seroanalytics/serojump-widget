#include "serojump.hpp"
#include <algorithm>
#include <cstring>
#include <limits>

SeroJumpSimulator::SeroJumpSimulator(unsigned seed) 
    : rng(seed), normal_dist(0.0, 1.0), uniform_dist(0.0, 1.0) {}

double SeroJumpSimulator::computeTitre(double baseline, double boost, double decay_rate,
                                     double infection_time, double sample_time) {
    if (sample_time <= infection_time) {
        return baseline;
    } else {
        double time_since_infection = sample_time - infection_time;
        return baseline + boost * std::exp(-decay_rate * time_since_infection);
    }
}

Individual SeroJumpSimulator::simulateIndividual(int id, const StudyParams& study_params,
                                                 const AntibodyParams& ab_params, 
                                                 int n_samples) {
    Individual individual;
    individual.id = id;
    individual.is_infected = (uniform_dist(rng) < study_params.infection_rate);
    
    // Generate baseline titre for this individual
    individual.baseline_titre = normal_dist(rng) * ab_params.baseline_sd + ab_params.baseline_mean;
    
    // Generate infection time if infected
    double infection_time = 0.0;
    if (individual.is_infected) {
        infection_time = uniform_dist(rng) * (study_params.study_end - study_params.study_start) + study_params.study_start;
        individual.true_infection_times.push_back(infection_time);
    }
    
    // Generate sample times uniformly across study period
    individual.sample_times.resize(n_samples);
    individual.titre_values.resize(n_samples);
    
    for (int i = 0; i < n_samples; i++) {
        double sample_time = (double(i) / (n_samples - 1)) * (study_params.study_end - study_params.study_start) + study_params.study_start;
        individual.sample_times[i] = sample_time;
        
        // Compute true titre based on infection status
        double true_titre;
        if (individual.is_infected) {
            double boost = normal_dist(rng) * ab_params.boost_sd + ab_params.boost_mean;
            true_titre = computeTitre(individual.baseline_titre, boost, ab_params.decay_rate, 
                                    infection_time, sample_time);
        } else {
            true_titre = individual.baseline_titre;
        }
        
        // Add observation noise
        individual.titre_values[i] = true_titre + normal_dist(rng) * ab_params.observation_sd;
    }
    
    return individual;
}

std::vector<Individual> SeroJumpSimulator::simulateStudy(const StudyParams& study_params,
                                                       const AntibodyParams& ab_params,
                                                       int n_samples_per_individual) {
    std::vector<Individual> individuals;
    individuals.reserve(study_params.n_individuals);
    
    for (int i = 0; i < study_params.n_individuals; i++) {
        individuals.push_back(simulateIndividual(i + 1, study_params, ab_params, n_samples_per_individual));
    }
    
    return individuals;
}

double SeroJumpSimulator::logLikelihood(const Individual& individual, const IndividualMCMC& params,
                                       const AntibodyParams& study_params) {
    double log_lik = 0.0;
    
    for (size_t i = 0; i < individual.sample_times.size(); i++) {
        double predicted_titre;
        
        if (params.infected_state) {
            predicted_titre = computeTitre(params.baseline, params.boost, study_params.decay_rate,
                                         params.infection_time, individual.sample_times[i]);
        } else {
            predicted_titre = params.baseline;
        }
        
        double residual = individual.titre_values[i] - predicted_titre;
        log_lik += -0.5 * std::log(2.0 * M_PI * study_params.observation_sd * study_params.observation_sd) 
                   - 0.5 * (residual * residual) / (study_params.observation_sd * study_params.observation_sd);
    }
    
    return log_lik;
}

double SeroJumpSimulator::logPriorBaseline(double baseline, const AntibodyParams& params) {
    double residual = baseline - params.baseline_mean;
    return -0.5 * std::log(2.0 * M_PI * params.baseline_sd * params.baseline_sd) 
           - 0.5 * (residual * residual) / (params.baseline_sd * params.baseline_sd);
}

double SeroJumpSimulator::logPriorBoost(double boost, const AntibodyParams& params) {
    if (boost <= 0.0) return -std::numeric_limits<double>::infinity();
    double residual = boost - params.boost_mean;
    return -0.5 * std::log(2.0 * M_PI * params.boost_sd * params.boost_sd) 
           - 0.5 * (residual * residual) / (params.boost_sd * params.boost_sd);
}

double SeroJumpSimulator::logPriorInfection(bool infected, double infection_time, 
                                          const StudyParams& study_params) {
    if (infected) {
        // Prior on infection probability + uniform prior on infection time
        return std::log(study_params.infection_rate) + 
               std::log(1.0 / (study_params.study_end - study_params.study_start));
    } else {
        return std::log(1.0 - study_params.infection_rate);
    }
}

IndividualMCMC SeroJumpSimulator::proposeParameters(const IndividualMCMC& current,
                                                   double baseline_step, double boost_step) {
    IndividualMCMC proposed = current;
    
    proposed.baseline = current.baseline + normal_dist(rng) * baseline_step;
    
    if (current.infected_state) {
        proposed.boost = current.boost + normal_dist(rng) * boost_step;
        // Ensure boost stays positive
        proposed.boost = std::max(0.001, proposed.boost);
    }
    
    return proposed;
}

IndividualMCMC SeroJumpSimulator::proposeInfectionTime(const IndividualMCMC& current,
                                                     const StudyParams& study_params) {
    IndividualMCMC proposed = current;
    
    if (current.infected_state) {
        // Random walk on infection time within study bounds
        double time_step = (study_params.study_end - study_params.study_start) * 0.1;
        proposed.infection_time = current.infection_time + normal_dist(rng) * time_step;
        
        // Reflect at boundaries
        while (proposed.infection_time < study_params.study_start || 
               proposed.infection_time > study_params.study_end) {
            if (proposed.infection_time < study_params.study_start) {
                proposed.infection_time = 2 * study_params.study_start - proposed.infection_time;
            }
            if (proposed.infection_time > study_params.study_end) {
                proposed.infection_time = 2 * study_params.study_end - proposed.infection_time;
            }
        }
    }
    
    return proposed;
}

IndividualMCMC SeroJumpSimulator::proposeInfectionState(const IndividualMCMC& current) {
    IndividualMCMC proposed = current;
    proposed.infected_state = !current.infected_state;
    
    if (proposed.infected_state && !current.infected_state) {
        // Moving from uninfected to infected - need to initialize boost and infection time
        proposed.boost = 1.0; // Default boost
        proposed.infection_time = 0.5; // Middle of study period (will be properly set by caller)
    }
    
    return proposed;
}

SeroJumpSimulator::MCMCStep SeroJumpSimulator::mcmcStepIndividual(
    const Individual& individual, const IndividualMCMC& current_params,
    const AntibodyParams& study_params, const StudyParams& study_settings) {
    
    MCMCStep result;
    result.accepted = false;
    result.acceptance_rate = 0.0;
    
    // Choose proposal type randomly
    double proposal_type = uniform_dist(rng);
    IndividualMCMC proposed;
    
    if (proposal_type < 0.5) {
        // Parameter update (baseline and boost)
        proposed = proposeParameters(current_params, 0.1, 0.2);
    } else if (proposal_type < 0.8 && current_params.infected_state) {
        // Infection time update (only if currently infected)
        proposed = proposeInfectionTime(current_params, study_settings);
    } else {
        // State change (infected/uninfected)
        proposed = proposeInfectionState(current_params);
        if (proposed.infected_state && !current_params.infected_state) {
            // Initialize infection time uniformly
            proposed.infection_time = uniform_dist(rng) * (study_settings.study_end - study_settings.study_start) + study_settings.study_start;
        }
    }
    
    // Calculate log-likelihoods and priors
    double current_log_lik = logLikelihood(individual, current_params, study_params);
    double proposed_log_lik = logLikelihood(individual, proposed, study_params);
    
    double current_log_prior = logPriorBaseline(current_params.baseline, study_params) +
                              logPriorInfection(current_params.infected_state, current_params.infection_time, study_settings);
    if (current_params.infected_state) {
        current_log_prior += logPriorBoost(current_params.boost, study_params);
    }
    
    double proposed_log_prior = logPriorBaseline(proposed.baseline, study_params) +
                               logPriorInfection(proposed.infected_state, proposed.infection_time, study_settings);
    if (proposed.infected_state) {
        proposed_log_prior += logPriorBoost(proposed.boost, study_params);
    }
    
    // Metropolis-Hastings acceptance
    double log_alpha = proposed_log_lik + proposed_log_prior - current_log_lik - current_log_prior;
    
    if (std::log(uniform_dist(rng)) < log_alpha) {
        result.params = proposed;
        result.params.log_likelihood = proposed_log_lik;
        result.accepted = true;
        result.acceptance_rate = std::min(1.0, std::exp(log_alpha));
    } else {
        result.params = current_params;
        result.params.log_likelihood = current_log_lik;
        result.accepted = false;
        result.acceptance_rate = std::min(1.0, std::exp(log_alpha));
    }
    
    return result;
}

// C interface functions
extern "C" {

SeroJumpSimulator* create_serojump_simulator(unsigned seed) {
    return new SeroJumpSimulator(seed);
}

void destroy_serojump_simulator(SeroJumpSimulator* simulator) {
    delete simulator;
}

int simulate_study(SeroJumpSimulator* simulator,
                  double study_start, double study_end, int n_individuals,
                  double infection_rate, int n_samples_per_individual,
                  double baseline_mean, double baseline_sd,
                  double boost_mean, double boost_sd, 
                  double decay_rate, double observation_sd,
                  int* individual_ids, double* sample_times, double* titre_values,
                  double* true_infection_times, int* infection_status,
                  int* out_total_samples) {
    
    if (!simulator) return 0;
    
    StudyParams study_params = {
        study_start, study_end, n_individuals, infection_rate, {}
    };
    
    AntibodyParams ab_params = {
        baseline_mean, baseline_sd, boost_mean, boost_sd, decay_rate, observation_sd
    };
    
    auto individuals = simulator->simulateStudy(study_params, ab_params, n_samples_per_individual);
    
    int total_samples = 0;
    for (const auto& individual : individuals) {
        for (size_t i = 0; i < individual.sample_times.size(); i++) {
            individual_ids[total_samples] = individual.id;
            sample_times[total_samples] = individual.sample_times[i];
            titre_values[total_samples] = individual.titre_values[i];
            infection_status[individual.id - 1] = individual.is_infected ? 1 : 0;
            total_samples++;
        }
        
        if (individual.is_infected && !individual.true_infection_times.empty()) {
            true_infection_times[individual.id - 1] = individual.true_infection_times[0];
        } else {
            true_infection_times[individual.id - 1] = -1.0;
        }
    }
    
    *out_total_samples = total_samples;
    return 1;
}

double compute_titre(double baseline, double boost, double decay_rate,
                    double infection_time, double sample_time) {
    if (sample_time <= infection_time) {
        return baseline;
    } else {
        double time_since_infection = sample_time - infection_time;
        return baseline + boost * std::exp(-decay_rate * time_since_infection);
    }
}

double compute_log_likelihood(int individual_id, double* sample_times, double* titre_values, int n_samples,
                             double baseline, double boost, double decay_rate,
                             double infection_time, int infected_state, double observation_sd) {
    double log_lik = 0.0;
    
    for (int i = 0; i < n_samples; i++) {
        double predicted_titre;
        
        if (infected_state) {
            predicted_titre = compute_titre(baseline, boost, decay_rate, infection_time, sample_times[i]);
        } else {
            predicted_titre = baseline;
        }
        
        double residual = titre_values[i] - predicted_titre;
        log_lik += -0.5 * std::log(2.0 * M_PI * observation_sd * observation_sd) 
                   - 0.5 * (residual * residual) / (observation_sd * observation_sd);
    }
    
    return log_lik;
}

int mcmc_step_individual(SeroJumpSimulator* simulator,
                       int individual_id, double* sample_times, double* titre_values, int n_samples,
                       double current_baseline, double current_boost, double current_infection_time,
                       int current_infected_state, double current_log_likelihood,
                       double study_start, double study_end, double infection_rate,
                       double baseline_mean, double baseline_sd, double boost_mean, double boost_sd,
                       double decay_rate, double observation_sd,
                       double baseline_step, double boost_step,
                       double* new_baseline, double* new_boost, double* new_infection_time,
                       int* new_infected_state, double* new_log_likelihood,
                       int* accepted, double* acceptance_rate) {
    
    if (!simulator) return 0;
    
    // Create individual from input data
    Individual individual;
    individual.id = individual_id;
    individual.sample_times.assign(sample_times, sample_times + n_samples);
    individual.titre_values.assign(titre_values, titre_values + n_samples);
    
    // Create current MCMC state
    IndividualMCMC current_params = {
        current_baseline, current_boost, current_infection_time,
        current_infected_state != 0, current_log_likelihood, infection_rate
    };
    
    // Create study parameters
    StudyParams study_params = {
        study_start, study_end, 1, infection_rate, {}
    };
    
    AntibodyParams ab_params = {
        baseline_mean, baseline_sd, boost_mean, boost_sd, decay_rate, observation_sd
    };
    
    // Perform MCMC step
    auto result = simulator->mcmcStepIndividual(individual, current_params, ab_params, study_params);
    
    // Copy results to output
    *new_baseline = result.params.baseline;
    *new_boost = result.params.boost;
    *new_infection_time = result.params.infection_time;
    *new_infected_state = result.params.infected_state ? 1 : 0;
    *new_log_likelihood = result.params.log_likelihood;
    *accepted = result.accepted ? 1 : 0;
    *acceptance_rate = result.acceptance_rate;
    
    return 1;
}

} // extern "C"
