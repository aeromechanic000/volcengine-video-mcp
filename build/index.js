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
server.tool("generate_video", "Generate AI videos via Volcengine. Supports Text-to-Video and Image-to-Video (using a reference image).", {
    prompt: z.string().describe("Text description of the video content"),
    model: z.string().default("doubao-seedance-1-5-pro-251215").describe("Volcengine Video Model/Endpoint ID"),
    savePath: z.string().describe("Path to save the generated MP4 file (e.g., ./my-video.mp4)"),
    referenceFilePath: z.string().optional().describe("Local path to an image to use as a first frame reference"),
    resolution: z.string().optional().default("720p").describe("Video resolution: 480p, 720p, or 1080p"),
    ratio: z.string().optional().default("16:9").describe("Video aspect ratio: 16:9, 9:16, or 1:1"),
    duration: z.number().optional().default(5).describe("Video duration in seconds (typically 3-10)"),
}, async ({ prompt, model, savePath, referenceFilePath, resolution, ratio, duration }) => {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
        return {
            isError: true,
            content: [{ type: "text", text: "❌ Error: `DOUBAO_API_KEY` not set. Please run `export DOUBAO_API_KEY='your_key'`." }]
        };
    }
    try {
        // Build the content array for the Seedance API
        // Format: { model, content: [{ type, text, image_url?, role? }] }
        const content = [];
        // Add text prompt with Seedance-specific flags
        // Format: "your prompt text --rs 720p --rt 16:9 --dur 5 --fps 24"
        const promptWithFlags = `${prompt.trim()} --rs ${resolution} --rt ${ratio} --dur ${duration} --fps 24`;
        content.push({
            type: 'text',
            text: promptWithFlags
        });
        // Add reference image if provided (first frame)
        if (referenceFilePath) {
            const absRefPath = path.resolve(process.cwd(), referenceFilePath);
            if (fs.existsSync(absRefPath)) {
                const fileBuffer = fs.readFileSync(absRefPath);
                const ext = path.extname(absRefPath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' :
                    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                        ext === '.webp' ? 'image/webp' : 'image/png';
                const base64Image = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: base64Image
                    },
                    role: 'first_frame'
                });
                console.error(`Status: Using reference image at ${absRefPath}`);
            }
            else {
                console.error(`Warning: Reference file not found at ${absRefPath}`);
            }
        }
        console.error(`Status: Requesting video generation task from ${model}...`);
        // Step 1: Create the video generation task
        const createResponse = await axios.post("https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks", {
            model: model,
            content: content
        }, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60000 // 60-second timeout for task creation
        });
        const taskId = createResponse.data.id;
        console.error(`Status: Task created with ID: ${taskId}`);
        // Step 2: Poll for task completion
        let taskStatus = "processing";
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max (1s intervals)
        const pollInterval = 1000;
        while (taskStatus === "processing" && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            const statusResponse = await axios.get(`https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`, {
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                },
                timeout: 30000
            });
            taskStatus = statusResponse.data.status;
            console.error(`Status: Task status: ${taskStatus} (${attempts + 1}/${maxAttempts})`);
            if (taskStatus === "succeed" || taskStatus === "succeeded") {
                // Step 3: Download the video
                // Response structure: { id, status, content: { video_url, last_frame_url } }
                const videoUrl = statusResponse.data.content?.video_url || statusResponse.data.video_url;
                if (!videoUrl) {
                    return { isError: true, content: [{ type: "text", text: `❌ Video Gen Failed: No video URL in response` }] };
                }
                console.error(`Status: Video ready, downloading from ${videoUrl}...`);
                const videoResponse = await axios.get(videoUrl, {
                    responseType: "arraybuffer",
                    timeout: 60000
                });
                const absoluteSavePath = path.resolve(process.cwd(), savePath);
                const dir = path.dirname(absoluteSavePath);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(absoluteSavePath, videoResponse.data);
                return {
                    content: [{ type: "text", text: `✅ Video success! Saved to: ${absoluteSavePath}\nModel: ${model}\nTask ID: ${taskId}` }]
                };
            }
            if (taskStatus === "failed") {
                const errorMsg = statusResponse.data.error || statusResponse.data.error_message || "Unknown error";
                return { isError: true, content: [{ type: "text", text: `❌ Video Gen Failed: Task failed with error: ${errorMsg}` }] };
            }
            attempts++;
        }
        if (attempts >= maxAttempts) {
            return { isError: true, content: [{ type: "text", text: "❌ Video Gen Failed: Task timed out after maximum polling time" }] };
        }
        return { isError: true, content: [{ type: "text", text: `❌ Video Gen Failed: Unexpected task status: ${taskStatus}` }] };
    }
    catch (error) {
        const status = error.response?.status;
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.error || error.message;
        if (status === 401)
            return { isError: true, content: [{ type: "text", text: "🚫 Invalid API Key. Please check your DOUBAO_API_KEY." }] };
        if (status === 403)
            return { isError: true, content: [{ type: "text", text: `🔒 Access Denied. Ensure the endpoint for '${model}' is active in Volcengine Ark.` }] };
        return { isError: true, content: [{ type: "text", text: `❌ Video Gen Failed: ${errorMsg}` }] };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
