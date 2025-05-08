'use client'; // Needed for dynamic date

import { useState, useEffect } from 'react';

export default function PrivacyPage() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);


  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Privacy Policy</h1>
      <p className="text-muted-foreground text-center">Last Updated: {currentDate || 'Loading...'}</p>

      {/* Added prose-lg for better readability */}
      <div className="prose prose-lg max-w-none dark:prose-invert">
        {/* Updated name */}
        <p>EduNexus ("we," "us," or "our") operates the EduNexus website and services (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>

        <h2 className="text-primary">1. Information Collection and Use</h2>
        <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
        <h3>Types of Data Collected</h3>
        <ul>
          <li><strong>Personal Data:</strong> While using our Service, especially during sign-up and profile updates, we may ask you to provide us with certain personally identifiable information ("Personal Data"). This may include, but is not limited to: Email address, Full name, Phone number, Academic Status.</li>
          <li><strong>Test Performance Data:</strong> To provide performance analysis and track progress, we collect data related to your test attempts, including scores, answers given, time taken per question, and overall performance metrics ("Test Performance Data"). This data is stored locally on your device.</li>
          <li><strong>AI Interaction Data:</strong> If you use AI-powered features like the Study Tips or Doubt Solving generator, we collect the inputs you provide (e.g., selected exam, subject, topic, difficulty, question text/image) and the outputs generated ("AI Interaction Data"). This data is used to provide the feature and potentially improve the AI models.</li>
          {/* Removed local storage reference as it's default now */}
          {/* <li><strong>Local Storage Data:</strong> Authentication tokens and user profile information (excluding sensitive details like passwords) are stored in your browser's local storage to maintain your session. Test results may also be stored locally.</li> */}
        </ul>

        <h2 className="text-primary">2. Use of Data</h2>
        <p>We use the collected data for various purposes:</p>
        <ul>
          <li>To provide and maintain the Service (authentication, test delivery, results display).</li>
          <li>To personalize your experience (e.g., showing relevant tests, generating tailored study tips).</li>
          <li>To notify you about changes to our Service or important account information (if notifications are enabled).</li>
          <li>To allow you to participate in interactive features like tests and AI tools.</li>
          <li>To provide customer support.</li>
          <li>To analyze usage patterns and improve the Service, including the performance and relevance of AI features.</li>
          <li>To monitor the usage of the Service for security and operational purposes.</li>
          <li>To detect, prevent and address technical issues.</li>
        </ul>

         <h2 className="text-primary">3. Use of AI Models</h2>
         {/* Updated brand name */}
        <p>Our AI features (Study Tips, Doubt Solving) use third-party AI models (currently Google's Gemini models via Genkit) to process your inputs and generate relevant advice or answers. </p>
        <ul>
            <li>The inputs you provide are sent to the AI model for processing.</li>
            <li>We do not intentionally include your Personal Data (like name or email) in the prompts sent to the AI, unless a feature explicitly requires it and obtains your consent.</li>
            <li>The AI Interaction Data may be used by the AI provider (Google) according to their privacy policies to improve their services. We recommend reviewing Google's AI privacy policies.</li>
            {/* Updated brand name */}
            <li>We use the generated tips/answers solely to display them to you within the EduNexus platform.</li>
            <li>We may analyze aggregated and anonymized AI Interaction Data to improve the feature's effectiveness.</li>
        </ul>

        <h2 className="text-primary">4. Data Storage and Security</h2>
        {/* Updated storage description */}
        <p>Your user account data (profile, password hash) is stored in a local `users.json` file on the server running the application. Test results and progress data are stored locally in your browser's storage and in JSON files within the `src/data` directory on the server. We implement reasonable security measures, including password hashing, to protect your data. However, local file storage and browser storage have inherent security limitations, especially compared to dedicated database solutions. This setup is primarily for demonstration and local development.</p>

        <h2 className="text-primary">5. Data Sharing and Service Providers</h2>
        {/* Updated service provider info */}
        <p>We may employ third-party companies and individuals ("Service Providers") to facilitate our Service (e.g., AI processing via Google AI). </p>
        <p>These third parties have access to your data only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose. We limit the data shared to what is necessary for the specific service (e.g., only interaction data is sent to the AI, not your full profile).</p>


        <h2 className="text-primary">6. Your Data Rights</h2>
        <p>Depending on your jurisdiction, you may have rights regarding your personal data, such as the right to access, correct, or delete your information. You can manage your profile information (name, phone) through the Settings page. Account deletion can be requested through the admin panel (if available) or by contacting support.</p>

        <h2 className="text-primary">7. Links to Other Sites</h2>
        <p>Our Service may contain links to other sites not operated by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.</p>

        <h2 className="text-primary">8. Children's Privacy</h2>
        <p>Our Service is not intended for children under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you believe a child has provided us with data, please contact us.</p>

        <h2 className="text-primary">9. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy. We will notify you of significant changes by posting the new policy on this page and updating the "Last Updated" date. You are advised to review this policy periodically.</p>

        <h2 className="text-primary">10. Contact Us</h2>
        {/* Updated email */}
        <p>If you have any questions about this Privacy Policy, please contact us at support@edunexus.com.</p>
      </div>
    </div>
  );
}
