import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { CONFIG, Config } from '../config';
/** Provider boundary: structured output only, no generated tool/code execution. */
@Injectable()
export class GeminiService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}
  async generate<T>(schema: z.ZodType<T>, context: unknown, instruction: string): Promise<T> {
    if (!this.config.ENABLE_GEMINI)
      throw new ServiceUnavailableException('Senku is unavailable right now. Please try again later.');
    const ai = new GoogleGenAI({
      vertexai: true,
      project: this.config.GOOGLE_CLOUD_PROJECT,
      location: this.config.GOOGLE_CLOUD_LOCATION,
    });
    const result = await ai.models.generateContent({
      model: this.config.GEMINI_MODEL,
      contents: JSON.stringify(context),
      config: {
        systemInstruction: `${instruction}\nProduct language: Speak as Senku. Never mention software providers, vendors, frameworks, APIs, Gemini, Google, or underlying implementation in learner-facing prose. Do not call the experience AI-powered. Use natural language about missions, adventures, tests and discoveries. Preserve accurate scientific concepts, model assumptions, units and supplied citation metadata; this rule concerns product branding, not scientific facts.`,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(schema),
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: { timeout: 60000 },
      },
    });
    return schema.parse(JSON.parse(result.text ?? ''));
  }
}
