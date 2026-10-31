import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export interface ValidationIssue {
  path: string;
  message: string;
}

export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Use lowercase letters, numbers and dashes, like "weather-api"',
  );

export function issuesFrom(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function invalidInput(issues: ValidationIssue[]): BadRequestException {
  return new BadRequestException({ error: 'INVALID_INPUT', issues });
}

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw invalidInput(issuesFrom(result.error));
  }
  return result.data;
}
