// SeroJump WebAssembly Application
class SeroJumpApp {
    constructor() {
        this.module = null;
        this.simulator = null;
        this.currentData = null;
        this.mcmcRunning = false;
        this.mcmcResults = {};
        
        // Colors for visualization
        this.colors = {
            infected: '#e74c3c',
            uninfected: '#27ae60',
            fitting: '#f39c12',
            observed: '#3498db',
            fitted: '#9b59b6',
            background: '#ecf0f1'
        };
        
        this.initialize();
    }
    
    async initialize() {
        try {
            await this.loadWebAssembly();
            this.setupEventListeners();
            this.createIndividualCards();
            this.showMainContent();
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async loadWebAssembly() {
        try {
            // Load the WebAssembly module
            this.module = await createSeroJumpModule();
            
            // Create the simulator instance
            this.simulator = this.module.ccall(
                'create_serojump_simulator', 'number', ['number'], [Date.now()]
            );
            
            console.log('✅ SeroJump WebAssembly module loaded successfully');
            
        } catch (error) {
            throw new Error(`Failed to load WebAssembly module: ${error.message}`);
        }
    }
    
    setupEventListeners() {
        // Slider updates
        const sliders = ['infection-rate', 'study-duration', 'samples-per-individual', 
                        'antibody-boost', 'uncertainty', 'mcmc-steps', 'burnin-steps'];
        
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(`${sliderId}-value`);
            
            slider.addEventListener('input', (e) => {
                this.updateSliderDisplay(sliderId, e.target.value);
            });
            
            // Initialize display
            this.updateSliderDisplay(sliderId, slider.value);
        });
        
        // Button events - simulate data button is now simulate-data-btn
        
        const fitBtn = document.getElementById('fit-btn');
        if (fitBtn) {
            fitBtn.addEventListener('click', () => this.startMCMCFitting());
        }
        
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAll());
        }
        
        // Data upload events
        const csvFileInput = document.getElementById('csv-file');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        const loadCsvBtn = document.getElementById('load-csv-btn');
        if (loadCsvBtn) {
            loadCsvBtn.addEventListener('click', () => this.loadCSVData());
        }
        
        const clearDataBtn = document.getElementById('clear-data-btn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => this.clearUserData());
        }
        
        const downloadSampleBtn = document.getElementById('download-sample-btn');
        if (downloadSampleBtn) {
            downloadSampleBtn.addEventListener('click', () => this.downloadSampleData());
        }
        
        const simulateDataBtn = document.getElementById('simulate-data-btn');
        if (simulateDataBtn) {
            simulateDataBtn.addEventListener('click', () => this.simulateData());
        }
        
        // Mode toggle events
        const simulateModeBtn = document.getElementById('simulate-mode-btn');
        if (simulateModeBtn) {
            simulateModeBtn.addEventListener('click', () => this.switchToSimulateMode());
        }
        
        const uploadModeBtn = document.getElementById('upload-mode-btn');
        if (uploadModeBtn) {
            uploadModeBtn.addEventListener('click', () => this.switchToUploadMode());
        }
        
        // Initialize UI state
        this.initializeUIState();
    }
    
    updateSliderDisplay(sliderId, value) {
        const valueDisplay = document.getElementById(`${sliderId}-value`);
        if (!valueDisplay) return;
        
        switch(sliderId) {
            case 'infection-rate':
                valueDisplay.textContent = `${Math.round(parseFloat(value) * 100)}%`;
                break;
            case 'study-duration':
                valueDisplay.textContent = `${value} months`;
                break;
            case 'samples-per-individual':
                valueDisplay.textContent = value;
                break;
            case 'antibody-boost':
                valueDisplay.textContent = parseFloat(value).toFixed(1);
                break;
            case 'uncertainty':
                valueDisplay.textContent = parseFloat(value).toFixed(2);
                break;
            case 'mcmc-steps':
                valueDisplay.textContent = value;
                break;
            case 'burnin-steps':
                valueDisplay.textContent = value;
                break;
        }
    }
    
    createIndividualCards() {
        const container = document.getElementById('trajectories-container');
        if (container) {
        container.innerHTML = '';
        
        for (let i = 1; i <= 10; i++) {
            const card = document.createElement('div');
            card.className = 'trajectory-card';
            card.id = `individual-${i}`;
            
            card.innerHTML = `
                <div class="individual-header">
                    <div class="individual-id">${i}</div>
                    <div class="infection-prob" id="prob-${i}">-</div>
                </div>
                <div class="individual-plot" id="plot-${i}"></div>
            `;
            
            container.appendChild(card);
            }
        }
    }
    
    createIndividualCardsForData(individuals) {
        const container = document.getElementById('trajectories-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Limit to maximum 10 individuals for visualization
        const maxIndividuals = 10;
        const individualsToShow = individuals.slice(0, maxIndividuals);
        
        // Add notification if we have more than 10 individuals
        if (individuals.length > maxIndividuals) {
            const notification = document.createElement('div');
            notification.className = 'data-limit-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <strong>Note:</strong> Showing first ${maxIndividuals} individuals out of ${individuals.length} total. 
                    All ${individuals.length} individuals will be included in the MCMC fitting.
                </div>
            `;
            container.appendChild(notification);
        }
        
        individualsToShow.forEach(individual => {
            const card = document.createElement('div');
            card.className = 'trajectory-card';
            card.id = `individual-${individual.id}`;
            
            card.innerHTML = `
                <div class="individual-header">
                    <div class="individual-id">${individual.id}</div>
                    <div class="infection-prob" id="prob-${individual.id}">-</div>
                </div>
                <div class="individual-plot" id="plot-${individual.id}"></div>
            `;
            
            container.appendChild(card);
        });
    }
    
    simulateData() {
        try {
            // Get simulation parameters from sliders
            const params = this.getSimulationParameters();
            
            // Simulate study data
            const studyData = this.callSimulateStudy(params);
            this.currentData = studyData;
            
            // Update visualization
            this.visualizeData(studyData);
            
            // Enable MCMC fitting
            const fitBtn = document.getElementById('fit-btn');
            if (fitBtn) fitBtn.disabled = false;
            
            // Enable reset button
            const resetBtn = document.getElementById('reset-btn');
            if (resetBtn) resetBtn.disabled = false;
            
            // Switch to simulation mode
            this.showSimulationMode();
            
            // Clear any uploaded data
            this.selectedFile = null;
            document.getElementById('csv-file').value = '';
            document.getElementById('load-csv-btn').disabled = true;
            
            console.log('📊 Study data simulated successfully', studyData);
            
        } catch (error) {
            this.showError(`Simulation failed: ${error.message}`);
        }
    }
    
    getSimulationParameters() {
        return {
            infectionRate: parseFloat(document.getElementById('infection-rate').value),
            studyDuration: parseInt(document.getElementById('study-duration').value),
            samplesPerIndividual: parseInt(document.getElementById('samples-per-individual').value),
            antibodyBoost: parseFloat(document.getElementById('antibody-boost').value),
            uncertainty: parseFloat(document.getElementById('uncertainty').value),
            baselineMean: 2.0,
            baselineSD: 0.3,
            boostSD: 0.2,
            observationSD: parseFloat(document.getElementById('uncertainty').value) // Use uncertainty slider
        };
    }
    
    callSimulateStudy(params) {
        const nIndividuals = 10;
        
        // Generate mock data directly in JavaScript for now
        const individuals = [];
        
        for (let i = 1; i <= nIndividuals; i++) {
            const individual = {
                id: i,
                sampleTimes: [],
                titreValues: [],
                trueInfectionTime: null,
                trueInfectionStatus: Math.random() < params.infectionRate
            };
            
            // Generate infection time if infected
            if (individual.trueInfectionStatus) {
                individual.trueInfectionTime = Math.random() * params.studyDuration;
            }
            
            // Generate sample times and titre values
            for (let j = 0; j < params.samplesPerIndividual; j++) {
                const sampleTime = (j / (params.samplesPerIndividual - 1)) * params.studyDuration;
                individual.sampleTimes.push(sampleTime);
                
                // Calculate titre based on infection status
                let titre = params.baselineMean + (Math.random() - 0.5) * params.baselineSD * 2;
                
                if (individual.trueInfectionStatus && individual.trueInfectionTime && sampleTime > individual.trueInfectionTime) {
                    // Permanent antibody boost (no waning/decay)
                    const boost = params.antibodyBoost + (Math.random() - 0.5) * params.boostSD * 2;
                    titre += boost;
                }
                
                // Add observation noise
                titre += (Math.random() - 0.5) * params.observationSD * 2;
                individual.titreValues.push(titre);
            }
            
            individuals.push(individual);
        }
        
        return individuals;
    }
    
    visualizeData(individuals) {
        // Create individual cards for the right number of individuals
        this.createIndividualCardsForData(individuals);
        
        // Update section title to show actual count
        const sectionTitle = document.querySelector('.visualization-area .section-title');
        if (sectionTitle) {
            const maxIndividuals = 10;
            const individualsToShow = Math.min(individuals.length, maxIndividuals);
            sectionTitle.textContent = `${individualsToShow} Individuals${individuals.length > maxIndividuals ? ` (of ${individuals.length} total)` : ''}`;
        }
        
        // Calculate global y-axis range for consistent scaling
        this.globalYRange = this.calculateGlobalYRange(individuals);
        
        // Only plot the first 10 individuals for visualization
        const maxIndividuals = 10;
        const individualsToPlot = individuals.slice(0, maxIndividuals);
        
        individualsToPlot.forEach(individual => {
            this.plotIndividualTrajectory(individual);
            this.updateIndividualCard(individual);
        });
    }
    
    calculateGlobalYRange(individuals) {
        let minY = Infinity;
        let maxY = -Infinity;
        
        for (const individual of individuals) {
            for (const titre of individual.titreValues) {
                minY = Math.min(minY, titre);
                maxY = Math.max(maxY, titre);
            }
        }
        
        // Add some padding
        const padding = (maxY - minY) * 0.1;
        return [minY - padding, maxY + padding];
    }
    
    plotIndividualTrajectory(individual, mcmcResults = null) {
        const plotDiv = document.getElementById(`plot-${individual.id}`);
        if (!plotDiv) {
            console.warn(`Plot div for individual ${individual.id} not found`);
            return;
        }
        
        // Observed data trace
        const observedTrace = {
            x: individual.sampleTimes,
            y: individual.titreValues,
            mode: 'markers+lines',
            type: 'scatter',
            name: 'Observed',
            marker: {
                size: 4,
                color: this.colors.observed,
                line: { width: 1, color: 'white' }
            },
            line: {
                color: this.colors.observed,
                width: 2
            }
        };
        
        const traces = [observedTrace];
        
        // Add posterior mean trajectory if MCMC results available
        if (mcmcResults && mcmcResults.infectionTimes.length >= 0) {
            const posteriorTrace = this.calculatePosteriorTrajectory(individual, mcmcResults);
            if (posteriorTrace) {
                traces.push(posteriorTrace);
            }
            
            // Add vertical lines for inferred infection times
            for (const infectionTime of mcmcResults.infectionTimes) {
                traces.push({
                    x: [infectionTime, infectionTime],
                    y: this.globalYRange || [0, 5],
                    mode: 'lines',
                    type: 'scatter',
                    name: 'Inferred Infection',
                    line: {
                        color: this.colors.fitted,
                        width: 1,
                        dash: 'dash'
                    },
                    opacity: 0.6,
                    showlegend: false
                });
            }
        }
        
        // Add true trajectory for comparison (only for simulated data)
        if (individual.trueInfectionTime !== null && individual.trueInfectionTime !== undefined) {
            const trueTrace = this.calculateTrueTrajectory(individual);
            if (trueTrace) {
                traces.push(trueTrace);
            }
            
            // Add vertical line for true infection time
            traces.push({
                x: [individual.trueInfectionTime, individual.trueInfectionTime],
                y: this.globalYRange || [0, 5],
                mode: 'lines',
                type: 'scatter',
                name: 'True Infection',
                line: {
                    color: '#999',
                    width: 2
                },
                opacity: 0.7,
                showlegend: false
            });
        }
        
        const layout = {
            margin: { l: 25, r: 5, t: 5, b: 20 },
            xaxis: { 
                title: '', 
                tickfont: { size: 8 },
                showgrid: false,
                range: [0, this.getSimulationParameters().studyDuration]
            },
            yaxis: { 
                title: '', 
                tickfont: { size: 8 },
                showgrid: false,
                range: this.globalYRange || [0, 5] // Use global range
            },
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const config = {
            displayModeBar: false,
            responsive: true
        };
        
        Plotly.newPlot(plotDiv, traces, layout, config);
    }
    
    calculatePosteriorTrajectory(individual, mcmcResults) {
        const params = this.getSimulationParameters();
        const timePoints = [];
        const titrePoints = [];
        
        // Create dense time points for smooth curve
        for (let t = 0; t <= params.studyDuration; t += 0.5) {
            timePoints.push(t);
            
            let predictedTitre = mcmcResults.baseline;
            
            // Add boosts from all inferred infections
            for (const infectionTime of mcmcResults.infectionTimes) {
                if (t > infectionTime) {
                    predictedTitre += mcmcResults.boost;
                }
            }
            
            titrePoints.push(predictedTitre);
        }
        
        return {
            x: timePoints,
            y: titrePoints,
            mode: 'lines',
            type: 'scatter',
            name: 'Posterior Mean',
            line: {
                color: this.colors.fitted,
                width: 2,
                dash: 'dash'
            },
            opacity: 0.8
        };
    }
    
    calculateTrueTrajectory(individual) {
        const params = this.getSimulationParameters();
        const timePoints = [];
        const titrePoints = [];
        
        // Create dense time points for smooth curve  
        for (let t = 0; t <= params.studyDuration; t += 0.5) {
            timePoints.push(t);
            
            let predictedTitre = params.baselineMean; // Use population mean as baseline
            
            // Add boost if after true infection time
            if (individual.trueInfectionTime && t > individual.trueInfectionTime) {
                predictedTitre += params.antibodyBoost;
            }
            
            titrePoints.push(predictedTitre);
        }
        
        return {
            x: timePoints,
            y: titrePoints,
            mode: 'lines',
            type: 'scatter',
            name: 'True',
            line: {
                color: '#999',
                width: 1,
                dash: 'dot'
            },
            opacity: 0.5
        };
    }
    
    updateIndividualCard(individual, mcmcResults = null) {
        const card = document.getElementById(`individual-${individual.id}`);
        const probElement = document.getElementById(`prob-${individual.id}`);
        
        if (!card || !probElement) {
            console.warn(`Card or prob element for individual ${individual.id} not found`);
            return;
        }
        
        // Update infection probability
        if (mcmcResults && mcmcResults.infectionProbability !== undefined) {
            const prob = mcmcResults.infectionProbability;
            if (probElement) {
            probElement.textContent = `${Math.round(prob * 100)}%`;
            }
            
            if (prob > 0.7) {
                if (probElement) probElement.className = 'infection-prob high';
                card.className = 'trajectory-card infected';
            } else if (prob > 0.3) {
                if (probElement) probElement.className = 'infection-prob medium';
                card.className = 'trajectory-card fitting';
            } else {
                if (probElement) probElement.className = 'infection-prob low';
                card.className = 'trajectory-card uninfected';
            }
        } else {
            // Initial state - show true infection status
            if (individual.trueInfectionStatus) {
                if (probElement) {
                probElement.textContent = 'Infected';
                probElement.className = 'infection-prob high';
                }
                card.className = 'trajectory-card infected';
            } else {
                if (probElement) {
                probElement.textContent = 'Uninfected';
                probElement.className = 'infection-prob low';
                }
                card.className = 'trajectory-card uninfected';
            }
        }
        
        // No detailed statistics in compact mode - just the infection probability badge
    }
    
    async startMCMCFitting() {
        if (this.mcmcRunning) return;
        
        this.mcmcRunning = true;
        document.getElementById('fit-btn').disabled = true;
        document.getElementById('mcmc-panel').style.display = 'block';
        document.getElementById('convergence-panel').style.display = 'block';
        document.getElementById('posterior-panel').style.display = 'block';
        
        // Initialize empty plots
        this.plotTotalInfections([], 0);
        this.plotIndividualProbabilities({});
        this.initializeConvergencePlots();
        
        const mcmcSteps = parseInt(document.getElementById('mcmc-steps').value);
        const burninSteps = parseInt(document.getElementById('burnin-steps').value);
        
        try {
            await this.runMCMCFitting(mcmcSteps, burninSteps);
        } catch (error) {
            this.showError(`MCMC fitting failed: ${error.message}`);
        } finally {
            this.mcmcRunning = false;
            document.getElementById('fit-btn').disabled = false;
        }
    }
    
    plotUserDataTiming(timingPosteriorSamples = null) {
        const plotDiv = document.getElementById('timing-comparison');
        
        if (!timingPosteriorSamples || Object.keys(timingPosteriorSamples).length === 0) {
            // Show empty state
            const layout = {
                margin: { l: 40, r: 10, t: 10, b: 40 },
                xaxis: { 
                    title: { text: 'Individual', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                yaxis: { 
                    title: { text: 'Inferred Infection Time', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'No timing data available',
                    showarrow: false,
                    font: { size: 12, color: '#666' }
                }]
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        // Create box plots for each individual's posterior infection timing
        const traces = [];
        const individualIds = [];
        const xPositions = [];
        
        let xPos = 1;
        for (const individual of this.currentData) {
            const posteriorTimes = timingPosteriorSamples[individual.id];
            if (posteriorTimes && posteriorTimes.length > 0) {
                // Calculate statistics for box plot
                const sorted = posteriorTimes.sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length * 0.25)];
                const median = sorted[Math.floor(sorted.length * 0.5)];
                const q3 = sorted[Math.floor(sorted.length * 0.75)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];
                
                traces.push({
                    y: [min, q1, median, q3, max],
                    type: 'box',
                    name: `ID${individual.id}`,
                    boxpoints: false,
                    marker: { color: '#3498db' },
                    line: { color: '#2980b9' }
                });
                
                individualIds.push(`ID${individual.id}`);
                xPositions.push(xPos);
                xPos++;
            }
        }
        
        if (traces.length === 0) {
            // Show empty state
            const layout = {
                margin: { l: 40, r: 10, t: 10, b: 40 },
                xaxis: { 
                    title: { text: 'Individual', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                yaxis: { 
                    title: { text: 'Inferred Infection Time', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'No timing data available',
                    showarrow: false,
                    font: { size: 12, color: '#666' }
                }]
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        const layout = {
            margin: { l: 40, r: 10, t: 10, b: 40 },
            xaxis: { 
                title: { text: 'Individual', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                tickvals: xPositions,
                ticktext: individualIds
            },
            yaxis: { 
                title: { text: 'Inferred Infection Time', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const config = { displayModeBar: false, responsive: true };
        Plotly.newPlot(plotDiv, traces, layout, config);
    }
    
    async runMCMCFitting(mcmcSteps, burninSteps) {
        const params = this.getSimulationParameters();
        // Use fewer chains for better performance with large step counts
        const nChains = mcmcSteps > 5000 ? 2 : 4;
        
        // Performance warning for very large step counts
        if (mcmcSteps > 10000) {
            console.warn(`Running MCMC with ${mcmcSteps} steps. This may take several minutes. Consider using fewer steps for faster results.`);
        }
        
        // Check if data exists
        if (!this.currentData || !Array.isArray(this.currentData)) {
            throw new Error('No simulation data available. Please generate data first.');
        }
        
        // Initialize this.mcmcResults for compatibility
        this.mcmcResults = {};
        for (const individual of this.currentData) {
            this.mcmcResults[individual.id] = {
                baseline: 0,
                boost: 0,
                infectionTimes: [],
                logLikelihood: -Infinity,
                infectionProbability: 0.0
            };
        }
        
        // Initialize four parallel chains
        const chains = [];
        for (let chainId = 0; chainId < nChains; chainId++) {
            chains[chainId] = {
                mcmcResults: {},
                posteriorSamples: {
                    baseline: [],
                    boost: [],
                    infectionTimes: [],
                    infectionCounts: []
                },
                individualInfectionProbs: {},
                timingPosteriorSamples: {}
            };
            
            // Initialize MCMC for each individual in this chain
        for (const individual of this.currentData) {
                chains[chainId].mcmcResults[individual.id] = {
                    baseline: params.baselineMean + (Math.random() - 0.5) * 0.2, // Slight variation between chains
                    boost: params.antibodyBoost + (Math.random() - 0.5) * 0.1,
                    infectionTimes: [],
                logLikelihood: -Infinity,
                infectionProbability: 0.0
            };
                
                chains[chainId].individualInfectionProbs[individual.id] = [];
                chains[chainId].timingPosteriorSamples[individual.id] = [];
            }
            
            // Track iteration numbers for trace plots
            chains[chainId].iterationNumbers = [];
        }
        
        // Calculate true number of infections
        const trueInfections = this.currentData.filter(ind => ind.trueInfectionStatus).length;
        
        // Combined posterior samples for summary statistics
        const combinedPosteriorInfectionCounts = [];
        const combinedIndividualInfectionProbs = {};
        const combinedPosteriorSamples = {
            baseline: [],
            boost: [],
            infectionTimes: []
        };
        const combinedTimingPosteriorSamples = {};
        
        // Initialize combined tracking
        for (const individual of this.currentData) {
            combinedIndividualInfectionProbs[individual.id] = [];
            combinedTimingPosteriorSamples[individual.id] = [];
        }
        
        // Initialize acceptance tracking
        let totalProposals = 0;
        let totalAcceptances = 0;
        
        // Thinning parameters for performance
        const thinningInterval = 10; // Only store every 10th sample
        let sampleCount = 0;
        
        // Performance tracking
        const startTime = Date.now();
        let lastProgressTime = startTime;
        
        // Run MCMC iterations
        for (let step = 0; step < mcmcSteps; step++) {
            // Run MCMC step for all chains in parallel
            for (let chainId = 0; chainId < nChains; chainId++) {
                const chain = chains[chainId];
                
                // Perform MCMC step for each individual in this chain
            for (const individual of this.currentData) {
                    const stepResult = await this.performMCMCStep(individual, params, chain.mcmcResults[individual.id]);
                    const result = stepResult.result;
                    const accepted = stepResult.accepted;
                    
                    // Track acceptance
                    totalProposals++;
                    if (accepted) {
                        totalAcceptances++;
                    }
                    
                    chain.mcmcResults[individual.id] = result;
                
                    // Update visualization if past burn-in (use first chain for display)
                    if (step >= burninSteps && chainId === 0) {
                    this.updateIndividualCard(individual, result);
                    // Update plots only every 200 steps for performance
                    if (step % 200 === 0) {
                            this.plotIndividualTrajectory(individual, result);
                        }
                    }
                    
                    // Update this.mcmcResults with results from first chain for compatibility
                    if (chainId === 0) {
                        this.mcmcResults[individual.id] = result;
                    }
                    
                    // Track posterior samples for this chain (with thinning)
                    if (step >= burninSteps) {
                        // Only store every thinningInterval-th sample
                        if (sampleCount % thinningInterval === 0) {
                            chain.individualInfectionProbs[individual.id].push(result.infectionProbability);
                            
                            // Track timing samples for box plots
                            if (result.infectionTimes.length > 0) {
                                chain.timingPosteriorSamples[individual.id].push(result.infectionTimes[0]);
                            }
                        
                        // Collect parameter samples
                            chain.posteriorSamples.baseline.push(result.baseline);
                            chain.posteriorSamples.boost.push(result.boost);
                        for (const infTime of result.infectionTimes) {
                                chain.posteriorSamples.infectionTimes.push(infTime);
                        }
                            
                            // Track iteration number for this sample
                            chain.iterationNumbers.push(step + 1);
                        }
                    }
            }
            
                // Track total infection count for this chain (after burn-in)
            if (step >= burninSteps) {
                    const totalInfected = Object.values(chain.mcmcResults)
                    .filter(result => result.infectionTimes.length > 0).length;
                    chain.posteriorSamples.infectionCounts.push(totalInfected);
                }
            }
            
            // Combine samples from all chains for summary statistics
            if (step >= burninSteps) {
                for (let chainId = 0; chainId < nChains; chainId++) {
                    const chain = chains[chainId];
                    
                    // Add to combined samples
                    combinedPosteriorInfectionCounts.push(chain.posteriorSamples.infectionCounts[chain.posteriorSamples.infectionCounts.length - 1]);
                    
                    for (const individual of this.currentData) {
                        const prob = chain.individualInfectionProbs[individual.id][chain.individualInfectionProbs[individual.id].length - 1];
                        combinedIndividualInfectionProbs[individual.id].push(prob);
                        
                        if (chain.timingPosteriorSamples[individual.id].length > 0) {
                            const timing = chain.timingPosteriorSamples[individual.id][chain.timingPosteriorSamples[individual.id].length - 1];
                            combinedTimingPosteriorSamples[individual.id].push(timing);
                        }
                    }
                    
                    // Add parameter samples
                    combinedPosteriorSamples.baseline.push(chain.posteriorSamples.baseline[chain.posteriorSamples.baseline.length - 1]);
                    combinedPosteriorSamples.boost.push(chain.posteriorSamples.boost[chain.posteriorSamples.boost.length - 1]);
                }
                
                // Update plots every 200 steps (reduced frequency)
                if (step % 200 === 0) {
                    this.plotTotalInfections(combinedPosteriorInfectionCounts, trueInfections);
                    this.plotIndividualProbabilities(combinedIndividualInfectionProbs);
                }
                
                // Update convergence diagnostics every 500 steps (reduced frequency)
                if (step % 500 === 0) {
                    this.updateConvergenceDiagnostics(chains, step, burninSteps);
                }
                
                // Update posterior analysis every 500 steps (reduced frequency)
                if (step % 500 === 0) {
                    this.updatePosteriorAnalysis(combinedPosteriorSamples, combinedTimingPosteriorSamples);
                }
            }
            
            // Increment sample count for thinning
            sampleCount++;
            
            // Update progress after processing all chains (throttled)
            if (step % 50 === 0 || step === mcmcSteps - 1) {
                const currentTime = Date.now();
                const elapsedTime = currentTime - startTime;
                const stepsPerSecond = (step + 1) / (elapsedTime / 1000);
                const estimatedTotalTime = mcmcSteps / stepsPerSecond;
                const remainingTime = Math.max(0, estimatedTotalTime - (elapsedTime / 1000));
                
                this.updateMCMCProgress(step, mcmcSteps, totalProposals, totalAcceptances, remainingTime);
                lastProgressTime = currentTime;
            }
            
            // Add small delay for visualization (reduced frequency)
            if (step % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
        
        // Final update
        this.updateMCMCProgress(mcmcSteps, mcmcSteps);
        const statusElement = document.getElementById('mcmc-status');
        if (statusElement) {
            statusElement.textContent = 'Completed';
        }
        
        // Final plot updates with posterior results
        for (const individual of this.currentData) {
            this.plotIndividualTrajectory(individual, this.mcmcResults[individual.id]);
        }
        
        // Calculate and display summary statistics
        this.updateSummaryStatistics(combinedPosteriorInfectionCounts, combinedIndividualInfectionProbs, trueInfections);
        
        // Final posterior analysis update
        this.updatePosteriorAnalysis(combinedPosteriorSamples, combinedTimingPosteriorSamples);
        
        // Log timing results for debugging
        console.log('=== Timing Inference Results ===');
        for (const individual of this.currentData) {
            const result = this.mcmcResults[individual.id];
            const trueTime = individual.trueInfectionTime;
            const inferredTimes = result.infectionTimes;
            console.log(`ID${individual.id}: True=${trueTime?.toFixed(1) || 'none'}, Inferred=[${inferredTimes.map(t => t.toFixed(1)).join(',')}]`);
        }
    }
    
    async performMCMCStep(individual, params, currentState = null) {
        const current = currentState || this.mcmcResults[individual.id];
        let proposed = JSON.parse(JSON.stringify(current)); // Deep copy
        
        // Choose move type for reversible-jump MCMC
        const rand = Math.random();
        let moveType = '';
        let logAcceptanceRatio = 0;
        
        if (rand < 0.3) {
            // Parameter updates (baseline and boost)
            moveType = 'parameters';
            const baselineStep = (Math.random() - 0.5) * 0.1;
            const boostStep = (Math.random() - 0.5) * 0.2;
            
            proposed.baseline = current.baseline + baselineStep;
            proposed.boost = Math.max(0.1, current.boost + boostStep);
            
        } else if (rand < 0.5 && current.infectionTimes.length > 0) {
            // Death move: Remove an infection time
            moveType = 'death';
            const removeIndex = Math.floor(Math.random() * current.infectionTimes.length);
            proposed.infectionTimes = current.infectionTimes.filter((_, i) => i !== removeIndex);
            
            // Jacobian for death move (going from k+1 to k dimensions)
            const k = current.infectionTimes.length;
            const priorRatio = (1 - params.infectionRate) / params.infectionRate; // Prior favors fewer infections
            logAcceptanceRatio += Math.log(k) + Math.log(params.studyDuration) + Math.log(priorRatio);
            
        } else if (rand < 0.7) {
            // Birth move: Add new infection time
            moveType = 'birth';
            const newInfectionTime = Math.random() * params.studyDuration;
            proposed.infectionTimes = [...current.infectionTimes, newInfectionTime].sort((a, b) => a - b);
            
            // Jacobian for birth move (going from k to k+1 dimensions)
            const k = current.infectionTimes.length;
            const priorRatio = params.infectionRate / (1 - params.infectionRate);
            logAcceptanceRatio -= Math.log(k + 1) + Math.log(params.studyDuration) + Math.log(priorRatio);
            
        } else if (current.infectionTimes.length > 0) {
            // Move: Change timing of existing infection
            moveType = 'move';
            const moveIndex = Math.floor(Math.random() * current.infectionTimes.length);
            const timeStep = (Math.random() - 0.5) * 2; // Random walk
            
            proposed.infectionTimes = [...current.infectionTimes];
            proposed.infectionTimes[moveIndex] = Math.max(0, 
                Math.min(params.studyDuration, current.infectionTimes[moveIndex] + timeStep));
            proposed.infectionTimes.sort((a, b) => a - b);
        }
        
        // Calculate log-likelihoods
        const currentLogLik = this.calculateLogLikelihood(individual, current, params);
        const proposedLogLik = this.calculateLogLikelihood(individual, proposed, params);
        
        // Metropolis-Hastings acceptance
        logAcceptanceRatio += proposedLogLik - currentLogLik;
        
        const accepted = Math.log(Math.random()) < logAcceptanceRatio;
        
        if (accepted) {
            // Accept proposal
            proposed.logLikelihood = proposedLogLik;
            // Infection probability is simply whether the individual has any infections (0 or 1)
            proposed.infectionProbability = proposed.infectionTimes.length > 0 ? 1.0 : 0.0;
            
            return { result: proposed, accepted: true };
        } else {
            // Reject proposal
            current.logLikelihood = currentLogLik;
            // Keep current infection probability
            current.infectionProbability = current.infectionTimes.length > 0 ? 1.0 : 0.0;
            return { result: current, accepted: false };
        }
    }
    
    calculateLogLikelihood(individual, mcmcState, params) {
        let logLikelihood = 0;
        
        for (let i = 0; i < individual.sampleTimes.length; i++) {
            const sampleTime = individual.sampleTimes[i];
            const observedTitre = individual.titreValues[i];
            
            let predictedTitre = mcmcState.baseline;
            
            // Add boosts from all infections that occurred before this sample
            for (const infectionTime of mcmcState.infectionTimes) {
                if (sampleTime > infectionTime) {
                    predictedTitre += mcmcState.boost; // Permanent boost (no waning)
                }
            }
            
            const residual = observedTitre - predictedTitre;
            logLikelihood -= 0.5 * Math.log(2 * Math.PI * params.observationSD * params.observationSD) +
                            0.5 * (residual * residual) / (params.observationSD * params.observationSD);
        }
        
        // Add priors
        // Prior on baseline (normal)
        const baselineResidual = mcmcState.baseline - params.baselineMean;
        logLikelihood -= 0.5 * (baselineResidual * baselineResidual) / (params.baselineSD * params.baselineSD);
        
        // Prior on boost (positive, log-normal-ish)
        if (mcmcState.boost > 0) {
            const boostResidual = mcmcState.boost - params.antibodyBoost;
            logLikelihood -= 0.5 * (boostResidual * boostResidual) / (params.boostSD * params.boostSD);
        } else {
            logLikelihood = -Infinity;
        }
        
        // Prior on number of infections (Poisson-like with rate parameter)
        const k = mcmcState.infectionTimes.length;
        const lambda = params.infectionRate * 2; // Expected number of infections
        logLikelihood += k * Math.log(lambda) - lambda; // Poisson prior (without k! term)
        
        return logLikelihood;
    }
    
    updatePosteriorAnalysis(posteriorSamples, timingPosteriorSamples = null) {
        this.plotPosteriorDensities(posteriorSamples);
        this.plotTimingComparison(timingPosteriorSamples);
    }
    
    plotPosteriorDensities(posteriorSamples) {
        const plotDiv = document.getElementById('posterior-densities');
        
        const traces = [];
        
        // Baseline posterior
        if (posteriorSamples.baseline.length > 10) {
            traces.push({
                x: posteriorSamples.baseline,
                type: 'histogram',
                name: 'Baseline',
                nbinsx: 20,
                opacity: 0.7,
                marker: { color: '#3498db' }
            });
        }
        
        // Boost posterior (offset for visibility)
        if (posteriorSamples.boost.length > 10) {
            traces.push({
                x: posteriorSamples.boost,
                type: 'histogram',
                name: 'Boost',
                nbinsx: 20,
                opacity: 0.7,
                marker: { color: '#e74c3c' },
                yaxis: 'y2'
            });
        }
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Parameter Value', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            yaxis: { 
                title: { text: 'Density', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                side: 'left'
            },
            yaxis2: {
                overlaying: 'y',
                side: 'right',
                tickfont: { size: 8 }
            },
            showlegend: true,
            legend: {
                x: 0.7,
                y: 0.95,
                font: { size: 8 }
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const config = {
            displayModeBar: false,
            responsive: true
        };
        
        if (traces.length > 0) {
            Plotly.newPlot(plotDiv, traces, layout, config);
        }
    }
    
    plotTimingComparison(timingPosteriorSamples = null) {
        const plotDiv = document.getElementById('timing-comparison');
        
        // Check if we have user data (no true values) or simulated data
        const hasTrueValues = this.currentData && this.currentData.some(ind => ind.trueInfectionTime !== null && ind.trueInfectionTime !== undefined);
        
        if (!hasTrueValues) {
            // For user data, show posterior infection timing distributions
            this.plotUserDataTiming(timingPosteriorSamples);
            return;
        }
        
        // Collect all posterior samples for timing analysis (simulated data)
        const timingData = [];
        const individualIds = [];
        
        for (const individual of this.currentData) {
            if (individual.trueInfectionTime !== null) {
                // Use the collected timing samples if available
                const posteriorTimes = timingPosteriorSamples && timingPosteriorSamples[individual.id] ? 
                    timingPosteriorSamples[individual.id] : [];
                
                if (posteriorTimes.length > 0) {
                    timingData.push({
                        trueTime: individual.trueInfectionTime,
                        posteriorTimes: posteriorTimes,
                        individualId: individual.id
                    });
                    individualIds.push(individual.id);
                }
            }
        }
        
        if (timingData.length === 0) {
            // Show empty state
            const layout = {
                margin: { l: 40, r: 10, t: 10, b: 40 },
                xaxis: { 
                    title: { text: 'True Infection Time', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                yaxis: { 
                    title: { text: 'Inferred Infection Time', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'No timing data available',
                    showarrow: false,
                    font: { size: 12, color: '#666' }
                }]
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        const traces = [];
        const params = this.getSimulationParameters();
        const maxTime = params.studyDuration;
        
        // Create box plots for each individual
        for (let i = 0; i < timingData.length; i++) {
            const data = timingData[i];
            const trueTime = data.trueTime;
            const posteriorTimes = data.posteriorTimes;
            
            // Calculate statistics for box plot
            posteriorTimes.sort((a, b) => a - b);
            const q1 = posteriorTimes[Math.floor(posteriorTimes.length * 0.25)];
            const median = posteriorTimes[Math.floor(posteriorTimes.length * 0.5)];
            const q3 = posteriorTimes[Math.floor(posteriorTimes.length * 0.75)];
            const min = posteriorTimes[0];
            const max = posteriorTimes[posteriorTimes.length - 1];
            
            // Calculate accuracy
            const error = Math.abs(median - trueTime);
            const color = error < 2.0 ? '#27ae60' : '#e74c3c';
            
            // Box plot trace
            traces.push({
                x: [trueTime],
                y: [median],
                type: 'box',
                name: `ID${data.individualId}`,
                boxpoints: 'outliers',
                jitter: 0.3,
                pointpos: 0,
                marker: {
                    color: color,
                    size: 4
                },
                line: {
                    color: color,
                    width: 2
                },
                fillcolor: color,
                opacity: 0.3,
                showlegend: false
            });
            
            // Add true time as vertical line
            traces.push({
                x: [trueTime, trueTime],
                y: [min, max],
                mode: 'lines',
                type: 'scatter',
                line: {
                    color: '#3498db',
                    width: 3
                },
                opacity: 0.8,
                showlegend: false
            });
        }
        
        // Perfect correlation line (y = x)
        traces.push({
            x: [0, maxTime],
            y: [0, maxTime],
            mode: 'lines',
            type: 'scatter',
            line: {
                color: '#95a5a6',
                width: 1,
                dash: 'dash'
            },
            name: 'Perfect',
            showlegend: false
        });
        
        const layout = {
            margin: { l: 40, r: 10, t: 10, b: 40 },
            xaxis: { 
                title: { text: 'True Infection Time', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                range: [0, maxTime]
            },
            yaxis: { 
                title: { text: 'Inferred Infection Time', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                range: [0, maxTime]
            },
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            annotations: [{
                x: maxTime * 0.1,
                y: maxTime * 0.9,
                text: `Individuals: ${timingData.length}<br>Box plots show posterior uncertainty`,
                showarrow: false,
                font: { size: 9 },
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#ddd',
                borderwidth: 1
            }]
        };
        
        const config = {
            displayModeBar: false,
            responsive: true
        };
        
        Plotly.newPlot(plotDiv, traces, layout, config);
    }
    
    calculateRSquared(trueValues, inferredValues) {
        if (trueValues.length !== inferredValues.length || trueValues.length === 0) {
            return 0;
        }
        
        const n = trueValues.length;
        const meanTrue = trueValues.reduce((sum, val) => sum + val, 0) / n;
        
        let ssRes = 0; // Sum of squares of residuals
        let ssTot = 0; // Total sum of squares
        
        for (let i = 0; i < n; i++) {
            ssRes += Math.pow(trueValues[i] - inferredValues[i], 2);
            ssTot += Math.pow(trueValues[i] - meanTrue, 2);
        }
        
        return 1 - (ssRes / ssTot);
    }
    
    updateSummaryStatistics(posteriorInfectionCounts, individualInfectionProbs, trueInfections) {
        // Create the two new plots
        this.plotTotalInfections(posteriorInfectionCounts, trueInfections);
        this.plotIndividualProbabilities(individualInfectionProbs);
    }
    
    initializeConvergencePlots() {
        // Initialize empty convergence plots
        this.plotTracePlots([]);
        this.plotSMI([]);
        this.plotChainComparison([]);
        this.updateConvergenceStats({});
    }
    
    updateConvergenceDiagnostics(chains, step, burninSteps) {
        if (step < burninSteps) return;
        
        console.log('Updating convergence diagnostics, chains:', chains.length);
        
        // Calculate convergence statistics
        const convergenceStats = this.calculateConvergenceStats(chains);
        
        // Update plots
        this.plotTracePlots(chains);
        this.plotSMI(chains);
        this.plotChainComparison(chains);
        this.updateConvergenceStats(convergenceStats);
    }
    
    calculateConvergenceStats(chains) {
        const nChains = chains.length;
        const stats = {
            baseline: { rhat: 0, ess: 0, mean: 0, sd: 0 },
            boost: { rhat: 0, ess: 0, mean: 0, sd: 0 },
            infectionCount: { rhat: 0, ess: 0, mean: 0, sd: 0 }
        };
        
        console.log('Calculating convergence stats for', nChains, 'chains');
        
        // Calculate Rhat and ESS for each parameter
        for (const param of ['baseline', 'boost', 'infectionCount']) {
            const chainSamples = [];
            for (let chainId = 0; chainId < nChains; chainId++) {
                if (param === 'infectionCount') {
                    chainSamples.push(chains[chainId].posteriorSamples.infectionCounts);
                } else {
                    chainSamples.push(chains[chainId].posteriorSamples[param]);
                }
            }
            
            console.log(`Parameter ${param}:`, chainSamples.map(chain => chain.length));
            
            if (chainSamples.every(chain => chain.length > 0)) {
                const rhat = this.calculateRhat(chainSamples);
                const ess = this.calculateESS(chainSamples);
                const allSamples = chainSamples.flat();
                const mean = allSamples.reduce((sum, val) => sum + val, 0) / allSamples.length;
                const variance = allSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (allSamples.length - 1);
                const sd = Math.sqrt(variance);
                
                stats[param] = { rhat, ess, mean, sd };
                console.log(`${param}: Rhat=${rhat.toFixed(3)}, ESS=${ess}, Mean=${mean.toFixed(3)}`);
            }
        }
        
        return stats;
    }
    
    calculateRhat(chainSamples) {
        const nChains = chainSamples.length;
        const nSamples = Math.min(...chainSamples.map(chain => chain.length));
        
        if (nSamples < 2) return 1.0;
        
        // Calculate within-chain variance
        let W = 0;
        for (let chainId = 0; chainId < nChains; chainId++) {
            const chain = chainSamples[chainId].slice(0, nSamples);
            const chainMean = chain.reduce((sum, val) => sum + val, 0) / nSamples;
            const chainVar = chain.reduce((sum, val) => sum + Math.pow(val - chainMean, 2), 0) / (nSamples - 1);
            W += chainVar;
        }
        W /= nChains;
        
        // Calculate between-chain variance
        const allMeans = chainSamples.map(chain => {
            const samples = chain.slice(0, nSamples);
            return samples.reduce((sum, val) => sum + val, 0) / nSamples;
        });
        const grandMean = allMeans.reduce((sum, mean) => sum + mean, 0) / nChains;
        const B = allMeans.reduce((sum, mean) => sum + Math.pow(mean - grandMean, 2), 0) * nSamples / (nChains - 1);
        
        // Calculate Rhat
        const varPlus = ((nSamples - 1) / nSamples) * W + (1 / nSamples) * B;
        const rhat = Math.sqrt(varPlus / W);
        
        return rhat;
    }
    
    calculateESS(chainSamples) {
        const allSamples = chainSamples.flat();
        const n = allSamples.length;
        
        if (n < 2) return 0;
        
        // Calculate autocorrelation
        const mean = allSamples.reduce((sum, val) => sum + val, 0) / n;
        const variance = allSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
        
        let autocorrSum = 0;
        const maxLag = Math.min(100, Math.floor(n / 4));
        
        for (let lag = 1; lag <= maxLag; lag++) {
            let autocorr = 0;
            for (let i = 0; i < n - lag; i++) {
                autocorr += (allSamples[i] - mean) * (allSamples[i + lag] - mean);
            }
            autocorr /= (n - lag) * variance;
            autocorrSum += autocorr;
            
            // Stop if autocorrelation becomes negative
            if (autocorr <= 0) break;
        }
        
        const ess = n / (1 + 2 * autocorrSum);
        return Math.max(0, Math.floor(ess));
    }
    
    plotTracePlots(chains) {
        const plotDiv = document.getElementById('trace-plots');
        
        if (chains.length === 0) {
            const layout = {
                margin: { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { title: { text: 'Iteration', font: { size: 10 } } },
                yaxis: { title: { text: 'Parameter Value', font: { size: 10 } } },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)'
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        const traces = [];
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
        
        // Plot baseline parameter traces
        for (let chainId = 0; chainId < chains.length; chainId++) {
            const chain = chains[chainId];
            if (chain.posteriorSamples.baseline.length > 0) {
                // Use actual iteration numbers from the chain
                const iterations = chain.iterationNumbers || chain.posteriorSamples.baseline.map((_, i) => i + 1);
                traces.push({
                    x: iterations,
                    y: chain.posteriorSamples.baseline,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Chain ${chainId + 1} - Baseline`,
                    line: { color: colors[chainId % colors.length], width: 1 },
                    opacity: 0.7
                });
            }
        }
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Iteration', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            yaxis: { 
                title: { text: 'Parameter Value', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            showlegend: true,
            legend: { font: { size: 8 } },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
    }
    
    plotSMI(chains) {
        const plotDiv = document.getElementById('smi-plot');
        
        if (chains.length === 0) {
            const layout = {
                margin: { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { title: { text: 'Iteration', font: { size: 10 } } },
                yaxis: { title: { text: 'SMI', font: { size: 10 } } },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)'
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        // Calculate SMI for each chain
        const traces = [];
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
        
        for (let chainId = 0; chainId < chains.length; chainId++) {
            const chain = chains[chainId];
            const smiValues = this.calculateSMI(chain);
            
            if (smiValues.length > 0) {
                // Use actual iteration numbers for SMI plot
                const iterations = chain.iterationNumbers ? 
                    chain.iterationNumbers.slice(0, smiValues.length) : 
                    Array.from({length: smiValues.length}, (_, i) => i + 1);
                
                traces.push({
                    x: iterations,
                    y: smiValues,
                    mode: 'lines',
                    type: 'scatter',
                    name: `Chain ${chainId + 1}`,
                    line: { color: colors[chainId % colors.length], width: 2 }
                });
            }
        }
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Iteration', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            yaxis: { 
                title: { text: 'SMI', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            showlegend: true,
            legend: { font: { size: 8 } },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
    }
    
    calculateSMI(chain) {
        // SMI calculation based on model information criteria
        const smiValues = [];
        const samples = chain.posteriorSamples.baseline;
        
        for (let i = 10; i < samples.length; i += 10) {
            const recentSamples = samples.slice(Math.max(0, i - 50), i);
            if (recentSamples.length < 10) continue;
            
            // Calculate model complexity penalty
            const mean = recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
            const variance = recentSamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentSamples.length;
            
            // SMI approximation: -2 * log_likelihood + penalty
            const penalty = Math.log(recentSamples.length) * 2; // BIC-like penalty
            const smi = -2 * Math.log(variance) + penalty;
            smiValues.push(smi);
        }
        
        return smiValues;
    }
    
    plotChainComparison(chains) {
        const plotDiv = document.getElementById('chain-comparison');
        
        if (chains.length === 0) {
            const layout = {
                margin: { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { title: { text: 'Chain', font: { size: 10 } } },
                yaxis: { title: { text: 'Parameter Mean', font: { size: 10 } } },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)'
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        const traces = [];
        const chainIds = Array.from({length: chains.length}, (_, i) => i + 1);
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
        
        // Calculate parameter means for each chain
        const parameters = ['baseline', 'boost', 'infectionCount'];
        const parameterLabels = ['Baseline', 'Boost', 'Infection Count'];
        
        for (let p = 0; p < parameters.length; p++) {
            const param = parameters[p];
            const chainMeans = [];
            
            for (let chainId = 0; chainId < chains.length; chainId++) {
                const chain = chains[chainId];
                let samples = [];
                
                if (param === 'infectionCount') {
                    samples = chain.posteriorSamples.infectionCounts;
                } else {
                    samples = chain.posteriorSamples[param];
                }
                
                if (samples.length > 0) {
                    const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
                    chainMeans.push(mean);
                } else {
                    chainMeans.push(0);
                }
            }
            
            traces.push({
                x: chainIds,
                y: chainMeans,
                mode: 'markers+lines',
                type: 'scatter',
                name: parameterLabels[p],
                marker: { 
                    color: colors[p % colors.length],
                    size: 8
                },
                line: { 
                    color: colors[p % colors.length],
                    width: 2
                }
            });
        }
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Chain', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                tickmode: 'linear',
                tick0: 1,
                dtick: 1
            },
            yaxis: { 
                title: { text: 'Parameter Mean', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            showlegend: true,
            legend: { 
                font: { size: 8 },
                x: 0.7,
                y: 0.95
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
    }
    
    updateConvergenceStats(stats) {
        const statsDiv = document.getElementById('convergence-stats');
        
        if (Object.keys(stats).length === 0) {
            statsDiv.innerHTML = '<div style="font-size: 0.7rem; color: #666; text-align: center; margin-top: 50px;">Run MCMC to see convergence diagnostics</div>';
            return;
        }
        
        let html = '<div style="font-size: 0.7rem; font-family: monospace;">';
        
        for (const [param, stat] of Object.entries(stats)) {
            const rhatColor = stat.rhat < 1.1 ? '#27ae60' : stat.rhat < 1.2 ? '#f39c12' : '#e74c3c';
            const essColor = stat.ess > 100 ? '#27ae60' : stat.ess > 50 ? '#f39c12' : '#e74c3c';
            
            html += `<div style="margin-bottom: 8px; padding: 4px; background: #f8f9fa; border-radius: 3px;">`;
            html += `<div style="font-weight: bold; color: #333;">${param.charAt(0).toUpperCase() + param.slice(1)}</div>`;
            html += `<div>Rhat: <span style="color: ${rhatColor}; font-weight: bold;">${stat.rhat.toFixed(3)}</span></div>`;
            html += `<div>ESS: <span style="color: ${essColor}; font-weight: bold;">${stat.ess}</span></div>`;
            html += `<div>Mean: ${stat.mean.toFixed(3)}</div>`;
            html += `<div>SD: ${stat.sd.toFixed(3)}</div>`;
            html += `</div>`;
        }
        
        html += '</div>';
        statsDiv.innerHTML = html;
    }
    
    plotTotalInfections(posteriorInfectionCounts, trueInfections) {
        const plotDiv = document.getElementById('total-infections-plot');
        
        if (posteriorInfectionCounts.length === 0) {
            // Show empty state
            const layout = {
                margin: { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { 
                    title: { text: 'Number of Infections', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                yaxis: { 
                    title: { text: 'Frequency', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'Run MCMC to see posterior samples',
                    showarrow: false,
                    font: { size: 12, color: '#666' }
                }]
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        // Calculate posterior statistics
        const sortedCounts = [...posteriorInfectionCounts].sort((a, b) => a - b);
        const posteriorMean = posteriorInfectionCounts.reduce((sum, count) => sum + count, 0) / posteriorInfectionCounts.length;
        const ci_lower = sortedCounts[Math.floor(sortedCounts.length * 0.025)];
        const ci_upper = sortedCounts[Math.floor(sortedCounts.length * 0.975)];
        
        // Create histogram of posterior samples
        const traces = [{
            x: posteriorInfectionCounts,
            type: 'histogram',
            name: 'Posterior Samples',
            nbinsx: Math.max(5, Math.min(20, new Set(posteriorInfectionCounts).size)),
            opacity: 0.7,
            marker: { 
                color: '#3498db',
                line: { color: 'white', width: 1 }
            }
        }];
        
        // Add vertical line for true value
        const maxFreq = Math.max(...posteriorInfectionCounts.map(x => posteriorInfectionCounts.filter(y => y === x).length));
        traces.push({
            x: [trueInfections, trueInfections],
            y: [0, maxFreq],
            mode: 'lines',
            type: 'scatter',
            name: 'True Value',
            line: {
                color: '#e74c3c',
                width: 3
            },
            showlegend: false
        });
        
        // Add vertical line for posterior mean
        traces.push({
            x: [posteriorMean, posteriorMean],
            y: [0, maxFreq],
            mode: 'lines',
            type: 'scatter',
            name: 'Posterior Mean',
            line: {
                color: '#27ae60',
                width: 2,
                dash: 'dash'
            },
            showlegend: false
        });
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Number of Infections', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            yaxis: { 
                title: { text: 'Frequency', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 }
            },
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)',
            annotations: [{
                x: 0.02,
                y: 0.98,
                xref: 'paper',
                yref: 'paper',
                text: `True: ${trueInfections}<br>Mean: ${posteriorMean.toFixed(1)}<br>95% CI: [${ci_lower}, ${ci_upper}]<br>Samples: ${posteriorInfectionCounts.length}`,
                showarrow: false,
                font: { size: 9 },
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#ddd',
                borderwidth: 1
            }]
        };
        
        const config = {
            displayModeBar: false,
            responsive: true
        };
        
        Plotly.newPlot(plotDiv, traces, layout, config);
    }
    
    plotIndividualProbabilities(individualInfectionProbs) {
        const plotDiv = document.getElementById('individual-probabilities-plot');
        
        const individualIds = [];
        const posteriorProbs = [];
        const trueStatus = [];
        const colors = [];
        
        // Check if we have any data
        const hasData = Object.values(individualInfectionProbs).some(probs => probs.length > 0);
        
        if (!hasData) {
            // Show empty state
            const layout = {
                margin: { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { 
                    title: { text: 'Individual ID', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 }
                },
                yaxis: { 
                    title: { text: 'Infection Probability', font: { size: 10 } },
                    titlefont: { size: 10 },
                    tickfont: { size: 8 },
                    range: [0, 1]
                },
                showlegend: false,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                annotations: [{
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'Run MCMC to see infection probabilities',
                    showarrow: false,
                    font: { size: 12, color: '#666' }
                }]
            };
            Plotly.newPlot(plotDiv, [], layout, { displayModeBar: false, responsive: true });
            return;
        }
        
        for (const individual of this.currentData) {
            individualIds.push(individual.id);
            
            // Calculate mean posterior probability (proportion of samples where individual was infected)
            const probs = individualInfectionProbs[individual.id] || [];
            const meanProb = probs.length > 0 ? 
                probs.reduce((sum, prob) => sum + prob, 0) / probs.length : 0;
            posteriorProbs.push(meanProb);
            
            // True infection status
            trueStatus.push(individual.trueInfectionStatus ? 1 : 0);
            
            // Color by accuracy
            const predictedInfected = meanProb > 0.5;
            const correct = predictedInfected === individual.trueInfectionStatus;
            colors.push(correct ? '#27ae60' : '#e74c3c');
        }
        
        const traces = [{
            x: individualIds,
            y: posteriorProbs,
            mode: 'markers',
            type: 'scatter',
            name: 'Posterior Probability',
            marker: {
                size: 8,
                color: colors,
                line: { color: 'white', width: 1 }
            }
        }];
        
        // Add horizontal line at 0.5 threshold
        traces.push({
            x: [Math.min(...individualIds), Math.max(...individualIds)],
            y: [0.5, 0.5],
            mode: 'lines',
            type: 'scatter',
            name: 'Decision Threshold',
            line: {
                color: '#95a5a6',
                width: 1,
                dash: 'dash'
            },
            showlegend: false
        });
        
        // Add true infection status as background bars
        for (let i = 0; i < individualIds.length; i++) {
            if (trueStatus[i] === 1) {
                traces.push({
                    x: [individualIds[i] - 0.3, individualIds[i] + 0.3],
                    y: [0, 1],
                    mode: 'lines',
                    type: 'scatter',
                    name: 'True Infected',
                    line: {
                        color: '#3498db',
                        width: 3
                    },
                    opacity: 0.3,
                    showlegend: i === 0 // Only show legend for first one
                });
            }
        }
        
        const layout = {
            margin: { l: 30, r: 10, t: 10, b: 30 },
            xaxis: { 
                title: { text: 'Individual ID', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                tickmode: 'linear',
                tick0: 1,
                dtick: 1
            },
            yaxis: { 
                title: { text: 'Infection Probability', font: { size: 10 } },
                titlefont: { size: 10 },
                tickfont: { size: 8 },
                range: [0, 1]
            },
            showlegend: true,
            legend: {
                x: 0.7,
                y: 0.95,
                font: { size: 8 }
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const config = {
            displayModeBar: false,
            responsive: true
        };
        
        Plotly.newPlot(plotDiv, traces, layout, config);
    }
    
    updateMCMCProgress(currentStep, totalSteps, totalProposals = 0, totalAcceptances = 0, remainingTime = null) {
        const progressPercent = (currentStep / totalSteps) * 100;
        const progressFill = document.getElementById('mcmc-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
        }
        
        const currentStepElement = document.getElementById('mcmc-current-step');
        if (currentStepElement) {
            currentStepElement.textContent = currentStep;
        }
        
        const statusElement = document.getElementById('mcmc-status');
        if (statusElement) {
            if (currentStep < totalSteps) {
                let statusText = `Step ${currentStep}/${totalSteps}`;
                if (remainingTime !== null && remainingTime > 0) {
                    const minutes = Math.floor(remainingTime / 60);
                    const seconds = Math.floor(remainingTime % 60);
                    statusText += ` (~${minutes}m ${seconds}s remaining)`;
                }
                statusElement.textContent = statusText;
            } else {
                statusElement.textContent = 'Completed';
            }
        }
        
        // Update acceptance rate
        const acceptRateElement = document.getElementById('mcmc-accept-rate');
        if (acceptRateElement && totalProposals > 0) {
            const acceptRate = (totalAcceptances / totalProposals) * 100;
            acceptRateElement.textContent = acceptRate.toFixed(1);
        }
        
        // Update overall statistics
        const totalLogLik = Object.values(this.mcmcResults)
            .reduce((sum, result) => sum + (result.logLikelihood || 0), 0);
        const numInfected = Object.values(this.mcmcResults)
            .filter(result => result.infectionTimes && result.infectionTimes.length > 0).length;
        
        const logLikElement = document.getElementById('mcmc-log-likelihood');
        if (logLikElement) {
            logLikElement.textContent = totalLogLik.toFixed(1);
        }
        
        const numInfectedElement = document.getElementById('mcmc-num-infected');
        if (numInfectedElement) {
            numInfectedElement.textContent = numInfected;
        }
    }
    
    resetAll() {
        // Reset data
        this.currentData = null;
        this.mcmcResults = {};
        this.mcmcRunning = false;
        
        // Disable buttons
        const fitBtn = document.getElementById('fit-btn');
        const resetBtn = document.getElementById('reset-btn');
        const clearDataBtn = document.getElementById('clear-data-btn');
        
        if (fitBtn) fitBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        if (clearDataBtn) clearDataBtn.disabled = true;
        
        // Hide panels
        const mcmcPanel = document.getElementById('mcmc-panel');
        const convergencePanel = document.getElementById('convergence-panel');
        const posteriorPanel = document.getElementById('posterior-panel');
        
        if (mcmcPanel) mcmcPanel.style.display = 'none';
        if (convergencePanel) convergencePanel.style.display = 'none';
        if (posteriorPanel) posteriorPanel.style.display = 'none';
        
        // Clear individual cards
        this.createIndividualCards();
    }
    
    showMainContent() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }
    
    showError(message) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        const errorTextElement = document.getElementById('error-text');
        if (errorTextElement) {
            errorTextElement.textContent = message;
        }
        
        const errorMessageElement = document.getElementById('error-message');
        if (errorMessageElement) {
            errorMessageElement.style.display = 'block';
        }
    }
    
    initializeUIState() {
        // Start in simulation mode
        this.showSimulationMode();
    }
    
    showSimulationMode() {
        // Show simulation content, hide upload content
        const simulationContent = document.getElementById('simulation-mode-content');
        const uploadContent = document.getElementById('upload-mode-content');
        
        if (simulationContent) simulationContent.style.display = 'block';
        if (uploadContent) uploadContent.style.display = 'none';
    }
    
    showUploadMode() {
        // Show upload content, hide simulation content
        const simulationContent = document.getElementById('simulation-mode-content');
        const uploadContent = document.getElementById('upload-mode-content');
        
        if (simulationContent) simulationContent.style.display = 'none';
        if (uploadContent) uploadContent.style.display = 'block';
    }
    
    switchToSimulateMode() {
        // Update toggle buttons
        const simulateModeBtn = document.getElementById('simulate-mode-btn');
        const uploadModeBtn = document.getElementById('upload-mode-btn');
        
        if (simulateModeBtn) simulateModeBtn.classList.add('active');
        if (uploadModeBtn) uploadModeBtn.classList.remove('active');
        
        // Show simulation mode
        this.showSimulationMode();
        
        // Clear any uploaded data
        this.selectedFile = null;
        const csvFile = document.getElementById('csv-file');
        const loadCsvBtn = document.getElementById('load-csv-btn');
        if (csvFile) csvFile.value = '';
        if (loadCsvBtn) loadCsvBtn.disabled = true;
    }
    
    switchToUploadMode() {
        // Update toggle buttons
        const simulateModeBtn = document.getElementById('simulate-mode-btn');
        const uploadModeBtn = document.getElementById('upload-mode-btn');
        
        if (simulateModeBtn) simulateModeBtn.classList.remove('active');
        if (uploadModeBtn) uploadModeBtn.classList.add('active');
        
        // Show upload mode
        this.showUploadMode();
    }
    
    // Sample Data Generation
    generateSampleData() {
        const nIndividuals = 200;
        const nBleeds = 3;
        const infectionRate = 0.4; // 40% infected
        const studyDuration = 12; // months
        const baselineMean = 2.0;
        const antibodyBoost = 1.5;
        const boostSD = 0.3;
        const observationSD = 0.2;
        
        const data = [];
        
        for (let i = 1; i <= nIndividuals; i++) {
            const personId = `person${i}`;
            const isInfected = Math.random() < infectionRate;
            const infectionTime = isInfected ? Math.random() * studyDuration : null;
            
            // Generate 3 bleed times
            const bleedTimes = [];
            for (let j = 0; j < nBleeds; j++) {
                bleedTimes.push((j / (nBleeds - 1)) * studyDuration);
            }
            
            // Generate biomarker values
            for (const time of bleedTimes) {
                let titre = baselineMean + (Math.random() - 0.5) * 0.2; // Baseline variation
                
                // Add boost if infected and time is after infection
                if (isInfected && infectionTime !== null && time > infectionTime) {
                    const boost = antibodyBoost + (Math.random() - 0.5) * boostSD * 2;
                    titre += boost;
                }
                
                // Add observation noise
                titre += (Math.random() - 0.5) * observationSD * 2;
                
                // Ensure positive values
                titre = Math.max(0.1, titre);
                
                data.push({
                    personId: personId,
                    time: time,
                    biomarkerValue: titre
                });
            }
        }
        
        return data;
    }
    
    downloadSampleData() {
        const sampleData = this.generateSampleData();
        
        // Convert to CSV format
        const csvContent = [
            'person_id,time,biomarker_value',
            ...sampleData.map(row => `${row.personId},${row.time.toFixed(1)},${row.biomarkerValue.toFixed(3)}`)
        ].join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'serojump_sample_data.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    // CSV Data Upload Methods
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const loadCsvBtn = document.getElementById('load-csv-btn');
            if (loadCsvBtn) {
                loadCsvBtn.disabled = false;
            }
            this.selectedFile = file;
        }
    }
    
    async loadCSVData() {
        if (!this.selectedFile) {
            this.showError('Please select a CSV file first.');
            return;
        }
        
        try {
            console.log('Loading CSV file:', this.selectedFile.name);
            const text = await this.readFileAsText(this.selectedFile);
            console.log('File read successfully, length:', text.length);
            const data = this.parseCSV(text);
            console.log('CSV parsed successfully, records:', data.length);
            this.loadUserData(data);
        } catch (error) {
            console.error('CSV loading error:', error);
            this.showError(`Failed to load CSV file: ${error.message}`);
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const data = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length >= 3) {
                    const personId = parts[0];
                    const time = parseFloat(parts[1]);
                    const biomarkerValue = parseFloat(parts[2]);
                    
                    if (!isNaN(time) && !isNaN(biomarkerValue)) {
                        data.push({
                            personId: personId,
                            time: time,
                            biomarkerValue: biomarkerValue
                        });
                    }
                }
            }
        }
        
        return data;
    }
    
    loadUserData(csvData) {
        // Group data by person ID
        const individuals = {};
        csvData.forEach(row => {
            if (!individuals[row.personId]) {
                individuals[row.personId] = {
                    id: row.personId,
                    sampleTimes: [],
                    titreValues: [],
                    trueInfectionStatus: null, // Unknown for user data
                    trueInfectionTime: null    // Unknown for user data
                };
            }
            individuals[row.personId].sampleTimes.push(row.time);
            individuals[row.personId].titreValues.push(row.biomarkerValue);
        });
        
        // Convert to array and sort by person ID
        this.currentData = Object.values(individuals).sort((a, b) => a.id.localeCompare(b.id));
        
        // Update UI
        this.updateDataInfo();
        this.visualizeData(this.currentData);
        
        // Enable fit button
        const fitBtn = document.getElementById('fit-btn');
        if (fitBtn) {
            fitBtn.disabled = false;
        }
        
        const clearDataBtn = document.getElementById('clear-data-btn');
        if (clearDataBtn) {
            clearDataBtn.disabled = false;
        }
        
        // Enable reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.disabled = false;
        }
        
        // Switch to upload mode
        this.showUploadMode();
    }
    
    updateDataInfo() {
        if (this.currentData && this.currentData.length > 0) {
            const totalPoints = this.currentData.reduce((sum, ind) => sum + ind.sampleTimes.length, 0);
            const dataIndividuals = document.getElementById('data-individuals');
            const dataPoints = document.getElementById('data-points');
            const dataInfo = document.getElementById('data-info');
            
            if (dataIndividuals) {
                dataIndividuals.textContent = this.currentData.length;
            }
            if (dataPoints) {
                dataPoints.textContent = totalPoints;
            }
            if (dataInfo) {
                dataInfo.style.display = 'block';
            }
        }
    }
    
    clearUserData() {
        this.currentData = null;
        this.mcmcResults = {};
        this.mcmcRunning = false;
        
        // Reset UI
        const fitBtn = document.getElementById('fit-btn');
        const clearDataBtn = document.getElementById('clear-data-btn');
        const dataInfo = document.getElementById('data-info');
        const csvFile = document.getElementById('csv-file');
        const loadCsvBtn = document.getElementById('load-csv-btn');
        
        if (fitBtn) fitBtn.disabled = true;
        if (clearDataBtn) clearDataBtn.disabled = true;
        if (dataInfo) dataInfo.style.display = 'none';
        if (csvFile) csvFile.value = '';
        if (loadCsvBtn) loadCsvBtn.disabled = true;
        this.selectedFile = null;
        
        // Switch back to simulation mode
        this.showSimulationMode();
        
        // Hide panels
        const mcmcPanel = document.getElementById('mcmc-panel');
        const convergencePanel = document.getElementById('convergence-panel');
        const posteriorPanel = document.getElementById('posterior-panel');
        
        if (mcmcPanel) mcmcPanel.style.display = 'none';
        if (convergencePanel) convergencePanel.style.display = 'none';
        if (posteriorPanel) posteriorPanel.style.display = 'none';
        
        // Clear trajectories
        this.createIndividualCards();
    }
}

// Initialize the application when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.seroJumpApp = new SeroJumpApp();
});
