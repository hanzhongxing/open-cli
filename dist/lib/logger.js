"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
exports.logger = {
    info: (msg) => console.log(picocolors_1.default.cyan('ℹ'), msg),
    success: (msg) => console.log(picocolors_1.default.green('✔'), msg),
    warn: (msg) => console.log(picocolors_1.default.yellow('⚠'), msg),
    error: (msg) => console.log(picocolors_1.default.red('✖'), msg),
};
//# sourceMappingURL=logger.js.map