/**
 * Example weather tool demonstrating the Browser Operator tool system
 * Following Mastra pattern with Zod schemas
 */

import { createTool } from '@browser-operator/core/tools';
import { z } from 'zod';

/**
 * Simple weather tool that gets current weather for a city
 */
export const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get current weather information for a given city. Use this when the user asks about weather conditions.',
  inputSchema: z.object({
    city: z.string().describe('The city name (e.g., "San Francisco", "London")'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
  }),
  outputSchema: z.object({
    temperature: z.number().describe('Current temperature'),
    conditions: z.string().describe('Weather conditions (e.g., "sunny", "cloudy")'),
    humidity: z.number().describe('Humidity percentage'),
    city: z.string().describe('City name'),
  }),
  execute: async ({ context }) => {
    const { city, units } = context;

    // Simulate API call with mock data
    // In a real implementation, you would call a weather API here
    const isCelsius = units === 'celsius';
    const temperature = isCelsius ? 22 : 72;

    return {
      temperature,
      conditions: 'sunny',
      humidity: 65,
      city,
    };
  },
  metadata: {
    category: 'information',
    tags: ['weather', 'information', 'api'],
  },
});

/**
 * Calculator tool for basic math operations
 */
export const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform basic mathematical calculations. Supports addition, subtraction, multiplication, and division.',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The mathematical operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  outputSchema: z.object({
    result: z.number(),
    operation: z.string(),
  }),
  execute: async ({ context }) => {
    const { operation, a, b } = context;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
    }

    return {
      result,
      operation,
    };
  },
  metadata: {
    category: 'utility',
    tags: ['math', 'calculator', 'utility'],
  },
});

/**
 * Time tool that returns current time information
 */
export const timeTool = createTool({
  id: 'get_current_time',
  description: 'Get the current date and time. Use this when the user asks about the current time or date.',
  inputSchema: z.object({
    timezone: z.string().optional().describe('Optional timezone (e.g., "America/New_York")'),
  }),
  outputSchema: z.object({
    timestamp: z.number(),
    dateString: z.string(),
    timeString: z.string(),
    timezone: z.string(),
  }),
  execute: async ({ context }) => {
    const now = new Date();

    return {
      timestamp: now.getTime(),
      dateString: now.toLocaleDateString(),
      timeString: now.toLocaleTimeString(),
      timezone: context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
  metadata: {
    category: 'information',
    tags: ['time', 'date', 'utility'],
  },
});
