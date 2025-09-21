// Mock SeroJump WebAssembly Module for Development
// This is a placeholder until the real WASM module is built

function createSeroJumpModule() {
    return new Promise((resolve, reject) => {
        console.log("🚧 Loading mock SeroJump module (development mode)");
        
        // Simulate loading delay
        setTimeout(() => {
            const mockModule = {
                // Mock memory management
                _malloc: (size) => {
                    return new ArrayBuffer(size);
                },
                
                _free: (ptr) => {
                    // Mock free
                },
                
                getValue: (ptr, type) => {
                    // Return mock values based on type
                    switch(type) {
                        case 'i32': return Math.floor(Math.random() * 100);
                        case 'double': return Math.random() * 10;
                        default: return 0;
                    }
                },
                
                // Mock memory heaps
                HEAP32: {
                    buffer: new ArrayBuffer(1024 * 1024) // 1MB
                },
                
                HEAP64: {
                    buffer: new ArrayBuffer(1024 * 1024) // 1MB  
                },
                
                // Mock ccall function
                ccall: (funcName, returnType, argTypes, args) => {
                    console.log(`🎭 Mock call: ${funcName}`, args);
                    
                    switch(funcName) {
                        case 'create_serojump_simulator':
                            return 12345; // Mock simulator pointer
                            
                        case 'simulate_study':
                            return mockSimulateStudy(args);
                            
                        case 'mcmc_step_individual':
                            return mockMCMCStep(args);
                            
                        default:
                            return 1; // Success
                    }
                }
            };
            
            resolve(mockModule);
        }, 500);
    });
}

function mockSimulateStudy(args) {
    console.log("🎲 Mock: Simulating study data");
    
    // Extract parameters
    const [simulator, studyStart, studyDuration, nIndividuals, infectionRate, samplesPerIndividual] = args.slice(0, 6);
    const [baselineMean, baselineSD, boostMean, boostSD, decayRate, observationSD] = args.slice(6, 12);
    
    // Generate mock data
    const totalSamples = nIndividuals * samplesPerIndividual;
    
    // Mock individuals with varying infection status
    for (let i = 0; i < nIndividuals; i++) {
        const isInfected = Math.random() < infectionRate;
        const infectionTime = isInfected ? Math.random() * studyDuration : -1;
        
        for (let j = 0; j < samplesPerIndividual; j++) {
            const sampleIdx = i * samplesPerIndividual + j;
            const sampleTime = (j / (samplesPerIndividual - 1)) * studyDuration;
            
            // Generate mock titre value
            let titre = baselineMean + (Math.random() - 0.5) * baselineSD * 2;
            
            if (isInfected && sampleTime > infectionTime) {
                const timeSinceInfection = sampleTime - infectionTime;
                const boost = boostMean + (Math.random() - 0.5) * boostSD * 2;
                titre += boost * Math.exp(-decayRate * timeSinceInfection);
            }
            
            titre += (Math.random() - 0.5) * observationSD * 2;
            
            // Store mock data (would normally go to WebAssembly memory)
            // For mock, we'll let the calling code handle this
        }
    }
    
    return 1; // Success
}

function mockMCMCStep(args) {
    console.log("🔬 Mock: MCMC step");
    
    // Just return success - the calling code will handle mock results
    return 1;
}

// Export for global access
window.createSeroJumpModule = createSeroJumpModule;

