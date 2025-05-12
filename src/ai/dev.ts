// This file can be used to register flows for local development testing with `genkit start`

// Import flows to make them available in the Genkit Dev UI
import '@/ai/flows/predict-rank-flow'; 
import '@/ai/flows/custom-doubt-solving-flow'; // Added new doubt solving flow

console.log("Genkit flows (rank prediction, custom doubt solving) registered for dev environment.");