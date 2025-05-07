// src/app/admin/reports/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Printer, BarChartBig, Users, Info, Loader2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeneratedTest, TestSession, TestResultSummary, UserProfile } from '@/types';
import { getAllGeneratedTests, getGeneratedTestByCode } from '@/actions/generated-test-actions';
import { readUsers, getUserById } from '@/actions/user-actions'; // Added getUserById
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import TestHistoryDialog from '@/components/admin/test-history-dialog';
import TestRankingDialog from '@/components/admin/test-ranking-dialog';
import TestReportPrintPreview from '@/components/admin/test-report-print-preview';

// Helper function to calculate results (simplified version, adapt as needed)
function calculateBasicSummary(session: TestSession, testDef: GeneratedTest | null): Partial<TestResultSummary> & { score: number; percentage: number; correct: number; attempted: number } {
    if (!testDef) {
      return { testName: 'Unknown Test', submittedAt: new Date(session.startTime).toISOString(), totalQuestions: 0, score: 0, percentage: 0, correct: 0, attempted: 0 };
    }
    let allQuestions = [];
    if (testDef.testType === 'chapterwise' && testDef.questions) {
        allQuestions = testDef.questions;
    } else if (testDef.testType === 'full_length') {
        allQuestions = [
            ...(testDef.physics || []),
            ...(testDef.chemistry || []),
            ...(testDef.maths || []),
            ...(testDef.biology || []),
        ].filter(q => q);
    }


    let correctCount = 0;
    let attemptedCount = 0;
    let totalMarksPossible = 0;
    let score = 0;

    session.answers.forEach((userAns, index) => {
        const questionDef = allQuestions[index];
        if (!questionDef) return;

        totalMarksPossible += questionDef.marks;
        if (userAns.selectedOption) {
            attemptedCount++;
            const correctAnswerKey = questionDef.answer.replace('Option ', '').trim();
            if (userAns.selectedOption === correctAnswerKey) {
                correctCount++;
                score += questionDef.marks;
            }
        }
    });
    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;

    return {
        testName: testDef.name,
        submittedAt: new Date(session.endTime || session.startTime).toISOString(),
        totalQuestions: allQuestions.length,
        correct: correctCount,
        attempted: attemptedCount,
        score,
        percentage,
    };
}


export default function AdminReportsPage() {
  const { toast } = useToast();
  const [allTests, setAllTests] = useState<GeneratedTest[]>([]);
  const [filteredTests, setFilteredTests] = useState<GeneratedTest[]>([]);
  const [selectedTestType, setSelectedTestType] = useState<'all' | 'chapterwise' | 'full_length'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTestForHistory, setSelectedTestForHistory] = useState<GeneratedTest | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [selectedTestForRanking, setSelectedTestForRanking] = useState<GeneratedTest | null>(null);
  const [isRankingDialogOpen, setIsRankingDialogOpen] = useState(false);

  const [selectedTestForPrint, setSelectedTestForPrint] = useState<GeneratedTest | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printReportData, setPrintReportData] = useState<{
    test: GeneratedTest;
    attempts: Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }>;
  } | null>(null);


  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const testsData = await getAllGeneratedTests();
      setAllTests(testsData);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not load tests." });
      setAllTests([]);
    } finally {
      setIsLoading(false);
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

  const fetchTestAttempts = useCallback(async (testCode: string): Promise<Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }>> => {
    const attempts: Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }> = [];
    if (typeof window === 'undefined') return attempts; // Guard for SSR or pre-hydration

    const testDef = await getGeneratedTestByCode(testCode); // Fetch test definition once

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`testResult-${testCode}-`)) {
        const sessionJson = localStorage.getItem(key);
        if (sessionJson) {
          try {
            const sessionData: TestSession = JSON.parse(sessionJson);
            const summary = calculateBasicSummary(sessionData, testDef);
            const userProfile = await getUserById(sessionData.userId);

            attempts.push({
              ...summary,
              attemptId: key.replace('testResult-', ''),
              testCode: sessionData.testId,
              userId: sessionData.userId,
              user: userProfile || undefined,
            });
          } catch (e) {
            console.error(`Failed to parse or process attempt ${key}:`, e);
          }
        }
      }
    }
    // Sort by score descending for ranking
    attempts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return attempts;
  }, []);


  const handleViewHistory = async (test: GeneratedTest) => {
    setSelectedTestForHistory(test);
    setIsHistoryDialogOpen(true);
  };

  const handleViewRanking = async (test: GeneratedTest) => {
     setSelectedTestForRanking(test);
     setIsRankingDialogOpen(true);
  };

  const handlePrintReport = async (test: GeneratedTest) => {
    setIsLoading(true);
    try {
        const attempts = await fetchTestAttempts(test.test_code);
        setPrintReportData({ test, attempts });
        setSelectedTestForPrint(test);
        setIsPrintPreviewOpen(true);
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Could not prepare report for printing." });
    } finally {
        setIsLoading(false);
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Code</TableHead>
                <TableHead>Test Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead># Qs</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skel-${index}`}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                  <TableRow key={test.test_code}>
                    <TableCell className="font-mono text-xs">{test.test_code}</TableCell>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell className="capitalize">{test.testType.replace('_', ' ')}</TableCell>
                    <TableCell>{test.total_questions}</TableCell>
                    <TableCell>{test.duration} min</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewHistory(test)}>
                        <Users className="mr-1.5 h-3.5 w-3.5" /> History
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleViewRanking(test)}>
                        <BarChartBig className="mr-1.5 h-3.5 w-3.5" /> Rank
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePrintReport(test)} disabled={isLoading}>
                        {isLoading && selectedTestForPrint?.test_code === test.test_code ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Printer className="mr-1.5 h-3.5 w-3.5" />} Print
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
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredTests.length}</strong> of <strong>{allTests.length}</strong> total tests.
          </div>
        </CardFooter>
      </Card>

      {selectedTestForHistory && (
        <TestHistoryDialog
          isOpen={isHistoryDialogOpen}
          onClose={() => { setIsHistoryDialogOpen(false); setSelectedTestForHistory(null);}}
          test={selectedTestForHistory}
          fetchTestAttempts={fetchTestAttempts}
        />
      )}
      {selectedTestForRanking && (
        <TestRankingDialog
          isOpen={isRankingDialogOpen}
          onClose={() => { setIsRankingDialogOpen(false); setSelectedTestForRanking(null);}}
          test={selectedTestForRanking}
          fetchTestAttempts={fetchTestAttempts}
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
