
"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { managerReportSummary, ManagerReportSummaryOutput } from "@/ai/flows/manager-report-summary";
import { Button } from "@/components/ui/button";

export function AISummaryCard() {
  const [summary, setSummary] = useState<ManagerReportSummaryOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      const result = await managerReportSummary({
        dailySalesReport: "Revenue $4,200 today. Popular: Grilled Salmon. Card: 80%, Cash: 20%.",
        shiftReportSummary: "Staffing optimal. 1 minor break room issue resolved. Cash drawer balanced.",
        occupancyReport: "85% occupancy. 12 check-ins today. Forecast: High demand for tomorrow.",
        currentDate: new Date().toISOString().split('T')[0]
      });
      setSummary(result);
    } catch (error) {
      console.error("Summary error", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="col-span-1 shadow-sm h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          < Zap className="w-5 h-5 text-primary" />
          AI Daily Digest
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="text-primary hover:bg-primary/10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
        </Button>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground italic">
              "{summary.executiveSummary}"
            </p>
            <div>
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Critical Insights</h4>
              <ul className="space-y-2">
                {summary.keyInsights.slice(0, 3).map((insight, idx) => (
                  <li key={idx} className="flex gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
            {summary.anomalies.length > 0 && (
              <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <h4 className="text-xs font-bold text-destructive uppercase mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Anomalies
                </h4>
                <p className="text-xs text-destructive-foreground">{summary.anomalies[0]}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-2 bg-muted rounded flex flex-col items-center">
                <span className="text-xl font-bold">${summary.kpis.totalRevenue}</span>
                <span className="text-[10px] uppercase text-muted-foreground">Rev</span>
              </div>
              <div className="p-2 bg-muted rounded flex flex-col items-center">
                <span className="text-xl font-bold">{Math.round(summary.kpis.occupancyRate * 100)}%</span>
                <span className="text-[10px] uppercase text-muted-foreground">Occ</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className={cn("w-8 h-8 text-muted-foreground mb-4", loading && "animate-spin")} />
            <p className="text-sm text-muted-foreground">
              {loading ? "Synthesizing latest reports..." : "Click analyze to generate an executive daily summary."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
