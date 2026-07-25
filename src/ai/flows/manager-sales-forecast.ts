'use server';
/**
 * @fileOverview A Genkit flow for generating AI-powered sales forecasts for hotel managers.
 *
 * - managerSalesForecast - A function that handles the sales forecasting process.
 * - ManagerSalesForecastInput - The input type for the managerSalesForecast function.
 * - ManagerSalesForecastOutput - The return type for the managerSalesForecast function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const HistoricalDailySalesSchema = z.object({
  date: z.string().describe('The date of the sales record in YYYY-MM-DD format.'),
  totalRevenue: z.number().describe('Total revenue for the day.'),
  roomRevenue: z.number().describe('Revenue from room bookings for the day.'),
  foodAndDrinksRevenue: z.number().describe('Revenue from food and drinks for the day.'),
});

const ManagerSalesForecastInputSchema = z.object({
  historicalSalesData: z.array(HistoricalDailySalesSchema).describe('An array of historical daily sales records.'),
  forecastDurationInDays: z.number().int().positive().describe('The number of days into the future to forecast.'),
  includeWeeklyForecast: z.boolean().default(false).describe('Whether to include a weekly sales forecast.'),
  includeMonthlyForecast: z.boolean().default(false).describe('Whether to include a monthly sales forecast.'),
});
export type ManagerSalesForecastInput = z.infer<typeof ManagerSalesForecastInputSchema>;

const DailyForecastSchema = z.object({
  date: z.string().describe('The forecasted date in YYYY-MM-DD format.'),
  predictedTotalRevenue: z.number().describe('Predicted total revenue for the day.'),
  predictedRoomRevenue: z.number().describe('Predicted room revenue for the day.'),
  predictedFoodAndDrinksRevenue: z.number().describe('Predicted food and drinks revenue for the day.'),
});

const WeeklyForecastSchema = z.object({
  weekStartDate: z.string().describe('The start date of the forecasted week in YYYY-MM-DD format.'),
  predictedTotalRevenue: z.number().describe('Predicted total revenue for the week.'),
  predictedRoomRevenue: z.number().describe('Predicted room revenue for the week.'),
  predictedFoodAndDrinksRevenue: z.number().describe('Predicted food and drinks revenue for the week.'),
});

const MonthlyForecastSchema = z.object({
  month: z.string().describe('The forecasted month in YYYY-MM format.'),
  predictedTotalRevenue: z.number().describe('Predicted total revenue for the month.'),
  predictedRoomRevenue: z.number().describe('Predicted room revenue for the month.'),
  predictedFoodAndDrinksRevenue: z.number().describe('Predicted food and drinks revenue for the month.'),
});

const ManagerSalesForecastOutputSchema = z.object({
  dailyForecast: z.array(DailyForecastSchema).describe('An array of daily sales forecasts.'),
  weeklyForecast: z.array(WeeklyForecastSchema).optional().describe('An array of weekly sales forecasts, if requested.'),
  monthlyForecast: z.array(MonthlyForecastSchema).optional().describe('An array of monthly sales forecasts, if requested.'),
  overallTrendAnalysis: z.string().describe('A summary of the detected sales trends and insights.'),
});
export type ManagerSalesForecastOutput = z.infer<typeof ManagerSalesForecastOutputSchema>;

export async function managerSalesForecast(input: ManagerSalesForecastInput): Promise<ManagerSalesForecastOutput> {
  return managerSalesForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'managerSalesForecastPrompt',
  input: { schema: ManagerSalesForecastInputSchema },
  output: { schema: ManagerSalesForecastOutputSchema },
  prompt: `You are an expert financial analyst for a hotel, tasked with forecasting future sales trends.
Analyze the provided historical sales data and generate a sales forecast for the next {{{forecastDurationInDays}}} days.
Also provide weekly and monthly forecasts if requested by the 'includeWeeklyForecast' and 'includeMonthlyForecast' flags.

Historical Sales Data (most recent first, in YYYY-MM-DD format):
{{{JSON.stringify historicalSalesData}}}

Based on this data, provide:
1. A daily sales forecast for the next {{{forecastDurationInDays}}} days, with dates in YYYY-MM-DD format.
2. If requested, a weekly sales forecast. Each week should be represented by its start date in YYYY-MM-DD format.
3. If requested, a monthly sales forecast. Each month should be represented in YYYY-MM format.
4. An 'overallTrendAnalysis' summarizing detected sales trends, insights, and key drivers.

Consider daily, weekly, and monthly patterns, seasonality, and overall growth trends.
Ensure the forecast maintains a professional tone suitable for a hotel management system.`,
});

const managerSalesForecastFlow = ai.defineFlow(
  {
    name: 'managerSalesForecastFlow',
    inputSchema: ManagerSalesForecastInputSchema,
    outputSchema: ManagerSalesForecastOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
