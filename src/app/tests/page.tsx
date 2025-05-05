import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowRight } from "lucide-react"; // Added ArrowRight
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link'; // Import Link

// Example test series data (replace with actual data fetching)
const testItems = [
  { id: "mht-cet-phy-1", title: "MHT-CET Physics Mock Test 1", type: "Mock Test", exam: "MHT-CET", subject: "Physics", imageHint: "physics formula atoms", status: "New" },
  { id: "jee-main-full-3", title: "JEE Main Full Syllabus Test 3", type: "Full Syllabus Test", exam: "JEE Main", subject: "PCM", imageHint: "jee exam students writing", status: "Popular" },
  { id: "neet-bio-ch-cell", title: "NEET Biology: Cell Structure", type: "Chapter Test", exam: "NEET", subject: "Biology", imageHint: "biology cell microscope dna", status: "" },
  { id: "jee-adv-math-calc", title: "JEE Advanced Maths: Calculus", type: "Topic Test", exam: "JEE Advanced", subject: "Maths", imageHint: "mathematics calculus graph", status: "New" },
  { id: "mht-cet-chem-org", title: "MHT-CET Chemistry: Organic Basics", type: "Chapter Test", exam: "MHT-CET", subject: "Chemistry", imageHint: "chemistry beakers science lab", status: "" },
  { id: "neet-phy-mock-2", title: "NEET Physics Mock Test 2", type: "Mock Test", exam: "NEET", subject: "Physics", imageHint: "physics concepts motion energy", status: "Popular" },
];

export default function TestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground">Browse mock tests for MHT-CET, JEE & NEET.</p>
        </div>
         <div className="flex gap-2">
           <div className="relative w-full sm:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Search tests..." className="pl-10 w-full sm:w-64" />
           </div>
           <Button variant="outline">
             <Filter className="mr-2 h-4 w-4" />
             Filter
           </Button>
         </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {testItems.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col group">
            <CardHeader className="p-0 relative">
               <Image
                  src={`https://picsum.photos/seed/${item.id}/400/200`}
                  alt={item.title}
                  width={400}
                  height={200}
                  className="w-full h-40 object-cover"
                  data-ai-hint={item.imageHint}
                />
                {item.status && (
                  <Badge variant={item.status === 'Popular' ? 'destructive' : 'secondary'} className="absolute top-2 right-2">
                    {item.status}
                  </Badge>
                )}
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-grow">
              <Badge variant="outline" className="w-fit mb-2">{item.exam}</Badge>
              <CardTitle className="text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{item.title}</CardTitle>
              <CardDescription className="text-sm mb-3">{item.type} - {item.subject}</CardDescription>
              {/* Link the button to the dynamic test detail page */}
               <Link href={`/tests/${item.id}`} passHref className="mt-auto">
                 <Button variant="secondary" className="w-full">
                    View Details
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                 </Button>
               </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
