import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import Image from 'next/image';

// Example content data (replace with actual data fetching)
const contentItems = [
  { id: 1, title: "Introduction to React Hooks", type: "Article", category: "Web Development", imageHint: "react code programming" },
  { id: 2, title: "Understanding Async/Await in JavaScript", type: "Video", category: "Web Development", imageHint: "javascript code programming" },
  { id: 3, title: "Python Basics: Data Structures", type: "Interactive Exercise", category: "Programming", imageHint: "python code data structure" },
  { id: 4, title: "Machine Learning Fundamentals", type: "Course", category: "Data Science", imageHint: "machine learning brain nodes" },
  { id: 5, title: "CSS Grid Layout Explained", type: "Article", category: "Web Design", imageHint: "css grid layout web design" },
  { id: 6, title: "Building REST APIs with Node.js", type: "Video", category: "Web Development", imageHint: "nodejs server api code" },
];

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Explore Content</h1>
      <p className="text-muted-foreground">Browse our library of learning materials.</p>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search content..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {contentItems.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
            <CardHeader className="p-0">
               <Image
                  src={`https://picsum.photos/seed/${item.id}/400/200`}
                  alt={item.title}
                  width={400}
                  height={200}
                  className="w-full h-40 object-cover"
                  data-ai-hint={item.imageHint}
                />
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-grow">
              <CardTitle className="text-lg mb-1 leading-tight">{item.title}</CardTitle>
              <CardDescription className="text-sm mb-3">{item.type} - {item.category}</CardDescription>
              <Button variant="secondary" className="mt-auto w-full">View Details</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
