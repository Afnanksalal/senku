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
      throw new ServiceUnavailableException('Gemini is not configured');
    const ai = new GoogleGenAI({
      vertexai: true,
      project: this.config.GOOGLE_CLOUD_PROJECT,
      location: this.config.GOOGLE_CLOUD_LOCATION,
    });
    const result = await ai.models.generateContent({
      model: this.config.GEMINI_MODEL,
      contents: JSON.stringify(context),
      config: {
        systemInstruction: instruction,
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
