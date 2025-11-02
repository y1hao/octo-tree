#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const process_1 = __importDefault(require("process"));
const server_1 = require("@octotree/server");
const core_1 = require("@octotree/core");
const program = new commander_1.Command();
program
    .name('octo-tree')
    .description('Radial file tree visualization for git repositories')
    .option('-r, --repo <path>', 'Path to the repository to visualize', process_1.default.cwd())
    .option('-p, --port <number>', 'Port to run the web server on', '3000')
    .action(async (options) => {
    const port = Number(options.port);
    if (Number.isNaN(port)) {
        console.error('Port must be a number');
        process_1.default.exitCode = 1;
        return;
    }
    const repoPath = path_1.default.resolve(options.repo);
    console.log(`Launching visualization for repo: ${repoPath}`);
    try {
        await (0, server_1.startServer)({ port, repoPath });
    }
    catch (error) {
        if (error instanceof core_1.GitRepositoryError) {
            console.error(error.message);
            process_1.default.exitCode = 1;
            return;
        }
        console.error('Failed to start server:', error);
        process_1.default.exitCode = 1;
    }
});
program.parseAsync(process_1.default.argv);
//# sourceMappingURL=index.js.map