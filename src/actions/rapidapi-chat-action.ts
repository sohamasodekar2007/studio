// src/actions/rapidapi-chat-action.ts
'use server';

export interface RapidApiDoubtInput {
  questionText?: string;
  imageDataUri?: string; // Currently, this will only be acknowledged in text, not processed as an image by this endpoint example.
}

export interface RapidApiDoubtOutput {
  answer: string;
  error?: string;
}

interface RapidApiResponse {
  // Assuming a structure similar to OpenAI's Chat Completions API
  // This might need adjustment based on the actual API response
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  // Fallback if the structure is simpler
  message?: string; 
  data?: { response?: string };
  // Add other potential fields based on actual API response
  error?: string | { message: string };
}

export async function getRapidApiDoubtAnswer(input: RapidApiDoubtInput): Promise<RapidApiDoubtOutput> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;

  if (!rapidApiKey) {
    console.error("RAPIDAPI_KEY environment variable is not set.");
    return { answer: '', error: "Doubt solving service is not configured." };
  }

  if (!input.questionText && !input.imageDataUri) {
    return { answer: '', error: "Please provide a question or an image." };
  }

  let combinedContent = input.questionText || "";
  if (input.imageDataUri) {
    if (combinedContent) {
      combinedContent += "\n\n[An image was also provided with this question.]";
    } else {
      combinedContent = "[An image was provided with this question. Please analyze based on any accompanying text, or if you are capable, the image itself if it were passed directly to you - this text is a placeholder for the image content.]";
    }
    // Note: To actually send the image for processing with GPT-4o,
    // the API payload for 'messages' would need to be structured differently,
    // typically including the image as a base64 data URI within the content array.
    // The current example only shows text content.
    // Example for multimodal:
    // messages: [
    //   {
    //     role: "user",
    //     content: [
    //       { type: "text", text: input.questionText },
    //       { type: "image_url", image_url: { url: input.imageDataUri } }
    //     ]
    //   }
    // ]
    // This implementation will proceed with text-only for now based on the provided API call structure.
  }
  
  const systemPrompt = "You are EduNexus by GODWIN, an expert AI tutor specializing in MHT-CET, JEE, and NEET subjects (Physics, Chemistry, Mathematics, Biology). Provide clear, concise, and accurate answers. If the question involves calculations, show the steps. If it's a conceptual question, explain the concept thoroughly but simply.";


  const options = {
    method: 'POST',
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'gpt-4o.p.rapidapi.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // or gpt-3.5-turbo if preferred for speed/cost
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: combinedContent }
      ],
      // The 'json: true' in the original example was an option for the 'request' library,
      // not part of the payload to the API. Fetch handles JSON stringification.
    }),
  };

  try {
    const response = await fetch('https://gpt-4o.p.rapidapi.com/chat/completions', options);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`RapidAPI error: ${response.status} ${response.statusText}`, errorBody);
      return { answer: '', error: `Failed to get answer from AI service. Status: ${response.status}. Details: ${errorBody}` };
    }

    const data: RapidApiResponse = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      return { answer: data.choices[0].message.content };
    } else if (typeof data.message === 'string') { // Fallback for simpler structure
        return { answer: data.message };
    } else if (data.data && typeof data.data.response === 'string'){ // another fallback
        return { answer: data.data.response };
    }
     else if (data.error) {
      const errorMessage = typeof data.error === 'string' ? data.error : (data.error as { message: string }).message;
      return { answer: '', error: `API Error: ${errorMessage}` };
    }
    
    console.error("Unexpected API response structure:", data);
    return { answer: '', error: 'Received an unexpected response format from the AI service.' };

  } catch (error: any) {
    console.error("Error calling RapidAPI:", error);
    return { answer: '', error: `An error occurred: ${error.message}` };
  }
}
