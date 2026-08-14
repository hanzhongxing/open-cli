import pc from 'picocolors';
export const logger = {
    info: (msg) => console.log(pc.cyan('ℹ'), msg),
    success: (msg) => console.log(pc.green('✔'), msg),
    warn: (msg) => console.log(pc.yellow('⚠'), msg),
    error: (msg) => console.log(pc.red('✖'), msg),
};
//# sourceMappingURL=logger.js.map