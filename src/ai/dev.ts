// This file can be used to register flows for local development testing with `genkit start`

// Import flows to make them available in the Genkit Dev UI
// import '@/ai/flows/study-tip-flow'; // Removed as study-tip-flow is deleted
// import '@/ai/flows/doubt-solving-flow'; // Removed as doubt-solving-flow is deleted and replaced
import '@/ai/flows/predict-rank-flow'; // Add the new rank prediction flow

console.log("Rank prediction flow registered for dev environment.");
