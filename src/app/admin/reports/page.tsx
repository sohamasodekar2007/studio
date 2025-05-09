// src/app/admin/reports/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Printer, BarChartBig, Users, Info, Loader2, Search, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeneratedTest, TestSession, TestResultSummary, UserProfile } from '@/types';
import { getAllGeneratedTests } from '@/actions/generated-test-actions'; // Keep this
import { getAllReportsForTest } from '@/actions/test-report-actions'; // Use this action to get reports with user data
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import TestHistoryDialog from '@/components/admin/test-history-dialog';
import TestRankingDialog from '@/components/admin/test-ranking-dialog';
import TestReportPrintPreview from '@/components/admin/test-report-print-preview';

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [allTests, setAllTests] = useState<GeneratedTest[]>([]);
  const [filteredTests, setFilteredTests] = useState<GeneratedTest[]>([]);
  const [selectedTestType, setSelectedTestType] = useState<'all' | 'chapterwise' | 'full_length'>('all');
  const [isLoadingTests, setIsLoadingTests] = useState(true); // Renamed for clarity
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // For loading attempts/ranking/print
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTestForHistory, setSelectedTestForHistory] = useState<GeneratedTest | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [selectedTestForRanking, setSelectedTestForRanking] = useState<GeneratedTest | null>(null);
  const [isRankingDialogOpen, setIsRankingDialogOpen] = useState(false);

  const [selectedTestForPrint, setSelectedTestForPrint] = useState<GeneratedTest | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printReportData, setPrintReportData] = useState<{
    test: GeneratedTest;
    attempts: Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null; rank?: number }>; // Include user and rank
  } | null>(null);


  const fetchTests = useCallback(async () => {
    setIsLoadingTests(true);
    try {
      const testsData = await getAllGeneratedTests();
      setAllTests(testsData);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not load tests." });
      setAllTests([]);
    } finally {
      setIsLoadingTests(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    let currentTests = allTests;
    if (selectedTestType !== 'all') {
      currentTests = currentTests.filter(test => test.testType === selectedTestType);
    }
    if (searchTerm) {
      currentTests = currentTests.filter(test =>
        test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.test_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredTests(currentTests);
  }, [allTests, selectedTestType, searchTerm]);


  const handleViewHistory = async (test: GeneratedTest) => {
    setSelectedTestForHistory(test);
    setIsHistoryDialogOpen(true); // Dialog will handle fetching its own data
  };

  const handleViewRanking = async (test: GeneratedTest) => {
     setSelectedTestForRanking(test);
     setIsRankingDialogOpen(true); // Dialog will handle fetching its own data
  };

  const handlePrintReport = async (test: GeneratedTest) => {
    setIsLoadingDetails(true); // Indicate loading while preparing print data
    setSelectedTestForPrint(test); // Keep track of which test is being printed
    try {
        // Fetch attempts WITH user details directly using the correct action
        const attemptsData = await getAllReportsForTest(test.test_code);

        // Sort attempts by score for ranking in print preview
        const rankedAttempts = attemptsData
            .sort((a, b) => {
                const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
                if (scoreDiff !== 0) return scoreDiff;
                return (a.timeTakenMinutes ?? Infinity) - (b.timeTakenMinutes ?? Infinity); // Use time taken for tie-breaking
             })
            .map((att, index) => ({ ...att, rank: index + 1 }));

        setPrintReportData({ test, attempts: rankedAttempts });
        setIsPrintPreviewOpen(true);
    } catch (e) {
        console.error("Error preparing report for printing:", e);
        toast({ variant: "destructive", title: "Error", description: "Could not prepare report for printing." });
    } finally {
        setIsLoadingDetails(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Reports</h1>
          <p className="text-muted-foreground">Analyze test performance, view user history, and generate reports.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Select value={selectedTestType} onValueChange={(value) => setSelectedTestType(value as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by Test Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Test Types</SelectItem>
                <SelectItem value="chapterwise">Chapterwise</SelectItem>
                <SelectItem value="full_length">Full Length</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or code..."
                    className="pl-10 w-full sm:w-[250px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Code</TableHead><TableHead>Test Name</TableHead><TableHead>Type</TableHead><TableHead># Qs</TableHead><TableHead>Duration</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTests ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skel-${index}`}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-10" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTests.length > 0 ? (
                  filteredTests.map((test) => (
                    <TableRow key={test.test_code}>
                      <TableCell className="font-mono text-xs">{test.test_code}</TableCell><TableCell className="font-medium">{test.name}</TableCell><TableCell className="capitalize">{test.testType.replace('_', ' ')}</TableCell><TableCell>{test.total_questions}</TableCell><TableCell>{test.duration} min</TableCell><TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewHistory(test)}>
                          <Users className="mr-1.5 h-3.5 w-3.5" /> History
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleViewRanking(test)}>
                          <BarChartBig className="mr-1.5 h-3.5 w-3.5" /> Rank
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrintReport(test)} disabled={isLoadingDetails && selectedTestForPrint?.test_code === test.test_code}>
                          {isLoadingDetails && selectedTestForPrint?.test_code === test.test_code ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Printer className="mr-1.5 h-3.5 w-3.5" />} Print
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No tests found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredTests.length}</strong> of <strong>{allTests.length}</strong> total tests.
          </div>
        </CardFooter>
      </Card>

       {/* Dialogs */}
      {selectedTestForHistory && (
        <TestHistoryDialog
          isOpen={isHistoryDialogOpen}
          onClose={() => { setIsHistoryDialogOpen(false); setSelectedTestForHistory(null);}}
          test={selectedTestForHistory}
          // Pass the correct action to fetch attempts with user details
          fetchTestAttempts={getAllReportsForTest}
        />
      )}
      {selectedTestForRanking && (
        <TestRankingDialog
          isOpen={isRankingDialogOpen}
          onClose={() => { setIsRankingDialogOpen(false); setSelectedTestForRanking(null);}}
          test={selectedTestForRanking}
          // Pass the correct action to fetch attempts with user details
          fetchTestAttempts={getAllReportsForTest}
        />
      )}
      {isPrintPreviewOpen && printReportData && (
          <TestReportPrintPreview
            reportData={printReportData}
            onClose={() => {setIsPrintPreviewOpen(false); setPrintReportData(null); setSelectedTestForPrint(null);}}
          />
      )}
    </div>
  );
}

    