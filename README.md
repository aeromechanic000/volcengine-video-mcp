# Volcengine Video MCP for Claude Code 🎬

Developed by [@aeromechanic](https://github.com/aeromechanic000).  
A Model Context Protocol (MCP) server that enables **Claude Code** to generate high-fidelity AI videos using Volcengine's **Doubao-Seedance 1.5 Pro** model.

## ✨ Features

- **Text-to-Video**: Generate cinematic clips from natural language descriptions.
- **Image-to-Video**: Transform static images into dynamic videos using local reference files.
- **State-of-the-Art Model**: Defaults to `doubao-seedance-1-5-pro-251215` for industry-leading quality.

---

## 🚀 Quick Start

### 1. Install the MCP Server
Add the video generation tool to your Claude Code environment:
```bash
claude mcp add volc-vid -- npx -y @aeromechanic/volcengine-video-mcp
```

### 2. Set Your API Key

Set your VolcEngine API key as an environment variable (add this to your `.zshrc` or `.bashrc` for persistence):

```bash
export DOUBAO_API_KEY="your_volcengine_api_key_here"

```

---

## 🛠 Usage Examples

Once installed, you can simply ask Claude in plain English:

* **Simple Prompt**: *"Generate a 5s video of a neon-lit cyberpunk street in Tokyo and save it to ./tokyo.mp4"*
* **Image Reference**: *"Animate this character: ./assets/hero.png. Make him walk forward through a portal."*
* **Custom Model**: *"Use the lite version of Seedance to generate a quick test video of a cat jumping."*

---

## 📝 Configuration & Requirements

* **Model Endpoint**: You must have a valid **Endpoint ID** created in the [Volcengine Ark Console](https://www.volcengine.com/product/ark) for the `doubao-seedance-1-5-pro-251215` model.
* **Environment**: Ensure `DOUBAO_API_KEY` is set before starting your Claude Code session.

> **Tip**: The included `SKILL.md` file contains optional instructions you can add to your Claude Code configuration to help Claude better understand how to use this tool.

## 📂 Project Structure

* `src/index.ts`: The core MCP server logic.
* `SKILL.md`: (Optional) Procedural instructions for Claude Code to handle video workflows.
* `package.json`: Project metadata.

---

## 🤝 Contributing

Contributions are welcome! If you have suggestions for new features or find a bug, please open an issue or submit a pull request on the [GitHub repository](https://github.com/aeromechanic000/volcengine-video-mcp).

## 📄 License

MIT © [aeromechanic](https://github.com/aeromechanic000)
