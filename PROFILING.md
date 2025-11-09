# Performance Profiling Guide

This guide explains how to profile and identify performance bottlenecks in octo-tree's screenshot and video generation using Chrome DevTools (built into Node.js).

## Quick Start

Node.js has built-in Chrome DevTools support that requires no additional tools or code changes:

```bash
# Build the project
npm run build

# Start with inspector enabled
node --inspect packages/cli/dist/index.js video --max-seconds 10 --fps 10

# Or use the convenience scripts
npm run profile:video
npm run profile:screenshot
```

## Step-by-Step Profiling

### Step 1: Start with Inspector

Run your command with the `--inspect` flag:

```bash
node --inspect packages/cli/dist/index.js video --max-seconds 10 --fps 10
```

You'll see output like:
```
Debugger listening on ws://127.0.0.1:9229/...
For help, see: https://nodejs.org/en/docs/inspector
```

### Step 2: Connect Chrome DevTools

1. Open Chrome browser
2. Navigate to `chrome://inspect`
3. Under "Remote Target", you'll see your Node.js process
4. Click the **"inspect"** link

### Step 3: Record Performance

1. In the DevTools window, go to the **"Performance"** tab
2. Click the **record button** (circle icon) or press `Cmd+E` (Mac) / `Ctrl+E` (Windows/Linux)
3. Let your command run (e.g., video generation)
4. Click **stop** when done

### Step 4: Analyze the Flame Chart

The Performance tab shows:
- **Flame chart**: Visual representation of CPU time spent in each function
- **Call tree**: Hierarchical view of function calls
- **Bottom-up**: Functions sorted by total time
- **Event log**: Timeline of events

**How to read the flame chart:**
- **Width** = time spent (wider bars = more CPU time)
- **Height** = call stack depth (deeper = more nested calls)
- **Click** on any bar to zoom in and see details
- **Search** for function names (e.g., `captureFrame`, `page.goto`)

## Understanding the Results

### Common Bottlenecks

1. **Page Navigation (`page.goto`)**
   - Often the slowest operation
   - `waitUntil: 'networkidle0'` waits for all network activity
   - Look for wide bars in the flame chart

2. **DOM Waiting (`waitForSelector`, `waitForFunction`)**
   - Waiting for SVG/links to render
   - May indicate slow rendering in the browser

3. **Screenshot Capture (`page.screenshot`)**
   - PNG encoding overhead
   - High device scale factor increases time

4. **Video Frame Loop**
   - Each frame requires navigation
   - Look for repeated patterns in the flame chart

### Tips for Analysis

- **Look for the widest bars** - these are your bottlenecks
- **Search for specific functions** - use Ctrl+F to find `captureFrame`, `page.goto`, etc.
- **Compare before/after** - record profiles before and after optimizations
- **Focus on the biggest wins** - optimize operations that take the most time first

## Profiling Screenshots

```bash
# Profile a single screenshot
node --inspect packages/cli/dist/index.js screenshot --repo /path/to/repo
```

Then follow the same steps above to record and analyze.

## Profiling Videos

```bash
# Profile video generation (start with small test)
node --inspect packages/cli/dist/index.js video \
  --repo /path/to/repo \
  --max-seconds 5 \
  --fps 10
```

For videos, you'll see repeated patterns in the flame chart as each frame is captured.

## Convenience Scripts

The `package.json` includes convenience scripts:

```bash
# Profile screenshot generation
npm run profile:screenshot

# Profile video generation
npm run profile:video
```

These automatically build and start with `--inspect` enabled.

## Further Reading

- [Node.js Inspector](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Puppeteer Performance](https://pptr.dev/guides/performance)
