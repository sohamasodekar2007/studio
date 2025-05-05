'use client'; // Needed for dynamic date

import { useState, useEffect } from 'react';

export default function TermsPage() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);


  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Terms of Service</h1>
      <p className="text-muted-foreground text-center">Last Updated: {currentDate || 'Loading...'}</p>

      {/* Added prose-lg for better readability */}
      <div className="prose prose-lg max-w-none dark:prose-invert">
        <p>Welcome to ExamPrep Hub! These Terms of Service ("Terms") govern your use of the ExamPrep Hub website and services (collectively, the "Service") provided by ExamPrep Hub ("we," "us," or "our").</p>

        <h2 className="text-primary">1. Acceptance of Terms</h2>
        <p>By accessing or using the Service, including signing up for an account or using any features like the test series or AI tools, you agree to be bound by these Terms and our Privacy Policy. If you disagree with any part of the terms, you may not access the Service.</p>

        <h2 className="text-primary">2. Use of the Service</h2>
        <p>You agree to use the Service only for lawful purposes related to your personal exam preparation and in accordance with these Terms. You are responsible for all activity under your account.</p>
        <ul>
          <li>You must provide accurate information during registration and keep it updated via the Settings page.</li>
          <li>You are responsible for maintaining the confidentiality of your account password.</li>
          <li>You must not share your account access with others.</li>
          <li>You must not attempt to disrupt the Service, manipulate test results, misuse AI features (e.g., excessive requests, generating harmful content), or engage in any fraudulent activity.</li>
        </ul>

        <h2 className="text-primary">3. Intellectual Property</h2>
        <p>The Service and its original content (excluding user-provided data), including but not limited to text, graphics, logos, test questions, solutions, software, AI prompts, and analysis features, are the exclusive property of ExamPrep Hub and its licensors, protected by copyright and other intellectual property laws.</p>

        <h2 className="text-primary">4. User Content & Data</h2>
        <p>You retain ownership of your Personal Data. By using the Service, you grant us a license to use your Test Performance Data and AI Interaction Data (as defined in the Privacy Policy) solely to provide and improve the Service (e.g., performance analysis, personalized tips, feature enhancement). We handle your data according to our Privacy Policy.</p>

        <h2 className="text-primary">5. Test Content and AI-Generated Content</h2>
        <ul>
          <li><strong>Test Accuracy:</strong> Tests and analyses are for practice and educational purposes. While we aim for accuracy based on current exam patterns, we do not guarantee they perfectly reflect actual exams or predict your performance. Use them as a preparation tool at your own risk.</li>
          <li><strong>AI Content Disclaimer:</strong> Features like the Study Tips generator use AI models. The generated content is provided for informational purposes only. We do not guarantee the accuracy, completeness, or suitability of AI-generated advice. It may contain errors or omissions. You should always verify critical information and use your judgment. Reliance on AI-generated content is solely at your own risk.</li>
        </ul>


        <h2 className="text-primary">6. Fees and Payments (If Applicable)</h2>
        <p>Currently, ExamPrep Hub is offered free of charge. We reserve the right to introduce paid features or subscriptions in the future. Any changes to pricing or the introduction of fees will be communicated clearly in advance.</p>

        <h2 className="text-primary">7. Termination</h2>
        <p>We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including, but not limited to, a breach of these Terms (e.g., account sharing, misuse of AI features, illegal activity).</p>

        <h2 className="text-primary">8. Disclaimer of Warranties</h2>
        <p>The Service is provided "AS IS" and "AS AVAILABLE," without warranties of any kind, express or implied. This includes, but is not limited to, implied warranties of merchantability, fitness for a particular purpose (such as guaranteeing exam success), accuracy of content (including AI-generated tips), or non-infringement.</p>

        <h2 className="text-primary">9. Limitation of Liability</h2>
        <p>In no event shall ExamPrep Hub, its directors, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your access to, use of, or inability to use the Service, or reliance on any content (including test results or AI tips), even if advised of the possibility of such damages.</p>

        <h2 className="text-primary">10. Governing Law</h2>
        <p>These Terms shall be governed by the laws of [Your Jurisdiction - e.g., India, State of Maharashtra], without regard to conflict of law principles.</p>

        <h2 className="text-primary">11. Changes to Terms</h2>
        <p>We reserve the right to modify these Terms at any time. We will notify you of significant changes by posting the updated Terms on this page and updating the "Last Updated" date. Your continued use of the Service after changes constitutes acceptance.</p>

        <h2 className="text-primary">12. Contact Us</h2>
        <p>If you have questions about these Terms, please contact us at support@examprephub.app.</p>
      </div>
    </div>
  );
}

