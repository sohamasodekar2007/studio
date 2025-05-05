
export default function TermsPage() {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Terms of Service</h1>
      <p className="text-muted-foreground text-center">Last Updated: {currentDate}</p> {/* Dynamically set date */}

      <div className="prose prose-lg max-w-none dark:prose-invert">
         {/* Added prose-headings:text-primary to style headings */}
        <p>Welcome to ExamPrep Hub! These Terms of Service ("Terms") govern your use of the ExamPrep Hub website and services (collectively, the "Service") provided by ExamPrep Hub ("we," "us," or "our").</p> {/* Updated company name */}

        <h2 className="text-primary">1. Acceptance of Terms</h2>
        <p>By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, do not use the Service.</p>

        <h2 className="text-primary">2. Use of the Service</h2>
        <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You are responsible for all activity that occurs under your account, including taking tests and viewing results.</p> {/* Updated description */}
        <ul>
          <li>You must provide accurate and complete information when creating an account.</li>
          <li>You must maintain the security of your account password.</li>
          <li>You must not use the Service to engage in any illegal or fraudulent activity, including attempting to manipulate test results or share account access.</li> {/* Updated */}
        </ul>

        <h2 className="text-primary">3. Intellectual Property</h2>
        <p>The Service and its original content (including test questions, solutions, and analysis features), features, and functionality are and will remain the exclusive property of ExamPrep Hub and its licensors. The Service is protected by copyright, trademark, and other laws.</p> {/* Updated */}

        <h2 className="text-primary">4. User Content & Test Data</h2> {/* Updated heading */}
        <p>You retain ownership of the personal information you provide. By using the Service, you grant us a license to use your Test Performance Data (as defined in the Privacy Policy) solely for the purpose of providing you with performance analysis, tracking your progress, and improving the overall Service. We will not share your individual test performance data with third parties without your explicit consent, except as required by law or as necessary for service providers acting on our behalf (as detailed in the Privacy Policy).</p> {/* Updated section */}

        <h2 className="text-primary">5. Test Content and Accuracy</h2> {/* Updated heading */}
        <p>The tests and performance analysis provided by our Service are for educational and practice purposes only. While we strive for accuracy, we do not guarantee that the test content perfectly reflects the actual MHT-CET, JEE, or NEET exams in terms of difficulty or exact question types. Your use of the tests and reliance on the results is at your own risk.</p> {/* Updated section */}

        <h2 className="text-primary">6. Termination</h2>
        <p>We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms (e.g., sharing accounts, attempting to cheat).</p> {/* Updated example */}

        <h2 className="text-primary">7. Disclaimer of Warranties</h2>
        <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose (such as guaranteeing admission to any institution), and non-infringement.</p> {/* Updated */}

        <h2 className="text-primary">8. Limitation of Liability</h2>
        <p>In no event shall ExamPrep Hub, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service or reliance on the test results.</p> {/* Updated */}

        <h2 className="text-primary">9. Governing Law</h2>
        <p>These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction - e.g., India, State of Maharashtra], without regard to its conflict of law provisions.</p> {/* Added placeholder */}

        <h2 className="text-primary">10. Changes to Terms</h2>
        <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any significant changes by posting the new Terms on this page or through other communication channels.</p> {/* Updated */}

        <h2 className="text-primary">11. Contact Us</h2>
        <p>If you have any questions about these Terms, please contact us at support@examprephub.app.</p> {/* Updated email */}
      </div>
    </div>
  );
}
