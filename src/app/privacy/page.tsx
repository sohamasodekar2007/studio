
export default function PrivacyPage() {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Privacy Policy</h1>
      <p className="text-muted-foreground text-center">Last Updated: {currentDate}</p> {/* Dynamically set date */}

      <div className="prose prose-lg max-w-none dark:prose-invert">
        {/* Added prose-headings:text-primary to style headings */}
        <p>ExamPrep Hub ("we," "us," or "our") operates the ExamPrep Hub website and services (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>

        <h2 className="text-primary">1. Information Collection and Use</h2>
        <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
        <h3>Types of Data Collected</h3>
        <ul>
          <li><strong>Personal Data:</strong> While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). This may include, but is not limited to: Email address, Full name, Usage Data.</li>
          <li><strong>Test Performance Data:</strong> To provide performance analysis and track progress, we collect data related to your test attempts, including scores, answers given, time taken per question, and overall performance metrics ("Test Performance Data").</li> {/* Updated section */}
          <li><strong>Usage Data:</strong> We may also collect information on how the Service is accessed and used ("Usage Data"). This Usage Data may include information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</li>
        </ul>

        <h2 className="text-primary">2. Use of Data</h2>
        <p>We use the collected data for various purposes:</p>
        <ul>
          <li>To provide and maintain the Service</li>
          <li>To notify you about changes to our Service</li>
          <li>To allow you to participate in interactive features of our Service when you choose to do so (e.g., taking tests)</li> {/* Updated */}
          <li>To provide customer care and support</li>
          <li>To provide analysis or valuable information so that we can improve the Service</li>
          <li>To monitor the usage of the Service</li>
          <li>To detect, prevent and address technical issues</li>
          <li>To provide personalized performance analysis based on your Test Performance Data</li> {/* Updated */}
        </ul>

         <h2 className="text-primary">3. Use of AI Models (If Applicable)</h2> {/* Updated heading */}
        <p>Currently, ExamPrep Hub does not use AI models for generating test content or analyzing user performance beyond standard statistical methods. If we implement AI features in the future (e.g., for adaptive testing or personalized feedback), this section will be updated to detail how AI models process your data. Any such processing would be solely for the purpose of enhancing the Service provided within the ExamPrep Hub platform.</p> {/* Updated section */}

        <h2 className="text-primary">4. Data Security</h2>
        <p>The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data and Test Performance Data, we cannot guarantee its absolute security.</p>

        <h2 className="text-primary">5. Service Providers</h2>
        <p>We may employ third-party companies and individuals to facilitate our Service ("Service Providers"), provide the Service on our behalf, perform Service-related services (e.g., hosting, analytics), or assist us in analyzing how our Service is used. These third parties have access to your Personal Data and potentially Test Performance Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.</p> {/* Updated mention */}

        <h2 className="text-primary">6. Links to Other Sites</h2>
        <p>Our Service may contain links to other sites that are not operated by us. If you click a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.</p>

        <h2 className="text-primary">7. Children's Privacy</h2>
        <p>Our Service does not address anyone under the age of 13 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 13. If you are a parent or guardian and you are aware that your Child has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.</p>

        <h2 className="text-primary">8. Changes to This Privacy Policy</h2>
        <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>

        <h2 className="text-primary">9. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at support@examprephub.app.</p> {/* Updated email */}
      </div>
    </div>
  );
}
