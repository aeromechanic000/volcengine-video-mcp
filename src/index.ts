#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import fs from "fs";
import path from "path";

const server = new McpServer({
  name: "volcengine-video-mcp",
  version: "1.1.0",
});

server.tool(
  "generate_video",
  "Generate AI videos via Volcengine. Supports Text-to-Video and Image-to-Video (using a reference image).",
  {
    prompt: z.string().describe("Text description of the video content"),
    model: z.string().default("doubao-seedance-1-5-pro-251215").describe("Volcengine Video Model/Endpoint ID"),
    savePath: z.string().describe("Path to save the generated MP4 file (e.g., ./my-video.mp4)"),
    referenceFilePath: z.string().optional().describe("Local path to an image or video to use as a reference frame"),
  },
  async ({ prompt, model, savePath, referenceFilePath }) => {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      return {
        isError: true,
        content: [{ type: "text", text: "❌ Error: `DOUBAO_API_KEY` not set. Please run `export DOUBAO_API_KEY='your_key'`." }]
      };
    }

    try {
      let extraParams: any = {};
      
      // Handle reference file if provided
      if (referenceFilePath) {
        const absRefPath = path.resolve(process.cwd(), referenceFilePath);
        if (fs.existsSync(absRefPath)) {
          const fileBuffer = fs.readFileSync(absRefPath);
          extraParams.image_content = fileBuffer.toString('base64');
          console.error(`Status: Using reference file at ${absRefPath}`);
        } else {
          console.error(`Warning: Reference file not found at ${absRefPath}`);
        }
      }

      console.error(`Status: Requesting video from ${model}...`);

      const response = await axios.post(
        "https://ark.cn-beijing.volces.com/api/v3/video/generations",
        {
          model: model,
          prompt: prompt,
          ...extraParams,
          response_format: "b64_json"
        },
        {
          headers: { 
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 300000 // 5-minute timeout for video generation
        }
      );

      const videoB64 = response.data.data[0].b64_json;
      const buffer = Buffer.from(videoB64, 'base64');
      
      const absoluteSavePath = path.resolve(process.cwd(), savePath);
      const dir = path.dirname(absoluteSavePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      fs.writeFileSync(absoluteSavePath, buffer);

      return {
        content: [{ type: "text", text: `✅ Video success! Saved to: ${absoluteSavePath}\nModel: ${model}` }]
      };

    } catch (error: any) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error?.message || error.message;

      if (status === 401) return { isError: true, content: [{ type: "text", text: "🚫 Invalid API Key. Please check your DOUBAO_API_KEY." }] };
      if (status === 403) return { isError: true, content: [{ type: "text", text: `🔒 Access Denied. Ensure the endpoint for '${model}' is active in Volcengine Ark.` }] };
      
      return { isError: true, content: [{ type: "text", text: `❌ Video Gen Failed: ${errorMsg}` }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);