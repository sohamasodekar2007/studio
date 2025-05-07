// This file can be used to register flows for local development testing with `genkit start`

// Import flows to make them available in the Genkit Dev UI
import '@/ai/flows/study-tip-flow';
import '@/ai/flows/doubt-solving-flow';
import '@/ai/flows/predict-rank-flow'; // Add the new rank prediction flow

console.log("Study tip, doubt solving, and rank prediction flows registered for dev environment.");
