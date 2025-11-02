"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRepositoryTree = exports.GitRepositoryError = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
class GitRepositoryError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GitRepositoryError';
    }
}
exports.GitRepositoryError = GitRepositoryError;
const joinRelative = (parent, segment) => {
    return parent === '.' ? segment : `${parent}/${segment}`;
};
const makeId = (relativePath, type) => {
    return `${type}:${relativePath}`;
};
const normalizeRepositoryPath = async (repoPath) => {
    const resolved = path_1.default.resolve(repoPath);
    const stat = await fs_1.promises.stat(resolved);
    if (!stat.isDirectory()) {
        throw new GitRepositoryError(`Provided path is not a directory: ${resolved}`);
    }
    return resolved;
};
const resolveRepoRoot = async (repoPath) => {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
            cwd: repoPath
        });
        return stdout.trim();
    }
    catch (error) {
        throw new GitRepositoryError(`Failed to locate git repository at ${repoPath}`);
    }
};
const listGitManagedFiles = async (repoPath) => {
    const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoPath });
    return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
};
const ensureChild = (parent, child) => {
    const existing = parent.children.find((node) => node.id === child.id);
    if (existing) {
        return existing;
    }
    parent.children.push(child);
    return child;
};
const createDirectoryNode = (relativePath, name, depth) => ({
    id: makeId(relativePath, 'directory'),
    name,
    relativePath,
    type: 'directory',
    size: 0,
    mtimeMs: 0,
    depth,
    children: []
});
const createFileNode = (relativePath, name, depth, stats) => ({
    id: makeId(relativePath, 'file'),
    name,
    relativePath,
    type: 'file',
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    depth,
    children: []
});
const sortChildrenRecursively = (node) => {
    node.children.sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
    });
    node.children.forEach(sortChildrenRecursively);
};
const aggregateDirectoryMetadata = (node) => {
    if (node.type === 'file') {
        return { size: node.size, mtimeMs: node.mtimeMs };
    }
    let totalSize = 0;
    let latestMtime = node.mtimeMs;
    for (const child of node.children) {
        const childMetrics = aggregateDirectoryMetadata(child);
        totalSize += childMetrics.size;
        latestMtime = Math.max(latestMtime, childMetrics.mtimeMs);
    }
    node.size = totalSize;
    node.mtimeMs = latestMtime;
    return { size: totalSize, mtimeMs: latestMtime };
};
const buildRepositoryTree = async ({ repoPath }) => {
    const normalizedPath = await normalizeRepositoryPath(repoPath);
    const repoRoot = await resolveRepoRoot(normalizedPath);
    const repoName = path_1.default.basename(repoRoot);
    const relativeRootPath = '.';
    const rootNode = createDirectoryNode(relativeRootPath, repoName, 0);
    const nodeMap = new Map();
    nodeMap.set(relativeRootPath, rootNode);
    const gitManagedFiles = await listGitManagedFiles(repoRoot);
    await Promise.all(gitManagedFiles.map(async (gitPath) => {
        const segments = gitPath.split('/');
        let currentPath = relativeRootPath;
        let parentNode = rootNode;
        for (let index = 0; index < segments.length; index += 1) {
            const segment = segments[index];
            const isLeaf = index === segments.length - 1;
            const nextPath = joinRelative(currentPath, segment);
            if (isLeaf) {
                const absoluteFilePath = path_1.default.join(repoRoot, gitPath);
                let fileStats;
                try {
                    fileStats = await fs_1.promises.stat(absoluteFilePath);
                }
                catch (error) {
                    if (error.code === 'ENOENT') {
                        return;
                    }
                    throw error;
                }
                const fileNode = createFileNode(nextPath, segment, parentNode.depth + 1, fileStats);
                nodeMap.set(nextPath, fileNode);
                ensureChild(parentNode, fileNode);
            }
            else {
                let directoryNode = nodeMap.get(nextPath);
                if (!directoryNode) {
                    directoryNode = createDirectoryNode(nextPath, segment, parentNode.depth + 1);
                    nodeMap.set(nextPath, directoryNode);
                    ensureChild(parentNode, directoryNode);
                }
                parentNode = directoryNode;
                currentPath = nextPath;
            }
        }
    }));
    sortChildrenRecursively(rootNode);
    aggregateDirectoryMetadata(rootNode);
    return rootNode;
};
exports.buildRepositoryTree = buildRepositoryTree;
//# sourceMappingURL=index.js.map