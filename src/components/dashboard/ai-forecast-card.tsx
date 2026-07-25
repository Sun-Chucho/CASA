
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { managerSalesForecast, ManagerSalesForecastOutput } from "@/ai/flows/manager-sales-forecast";
import { SALES_HISTORY } from "@/app/lib/mock-data";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export function AIForecastCard() {
  const [forecast, setForecast] = useState<ManagerSalesForecastOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const hasHistory = SALES_HISTORY.length > 0;

  async function handleGenerate() {
    if (!hasHistory) return;
    setLoading(true);
    try {
      const result = await managerSalesForecast({
        historicalSalesData: SALES_HISTORY,
        forecastDurationInDays: 7,
        includeWeeklyForecast: true,
        includeMonthlyForecast: false
      });
      setForecast(result);
    } catch (error) {
      console.error("Forecast error", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm border-orange-100 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-accent/30 border-b">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Sales Trend Forecast
          </CardTitle>
          <CardDescription>Predicted revenue for the upcoming week based on historical patterns</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleGenerate} 
          disabled={loading || !hasHistory}
          className="border-primary text-primary hover:bg-primary hover:text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Regenerate Forecast
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {forecast ? (
          <div className="space-y-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.dailyForecast}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F57C00" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#F57C00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                  />
                  <YAxis 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predictedTotalRevenue" 
                    stroke="#F57C00" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    name="Predicted Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
              <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trend Analysis
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {forecast.overallTrendAnalysis}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">AI Forecasting Offline</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              {hasHistory ? "Generate a predictive model based on your historical daily sales data." : "Forecasting will unlock after real sales history is recorded."}
            </p>
            <Button onClick={handleGenerate} disabled={loading || !hasHistory}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Generate 7-Day Forecast
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
