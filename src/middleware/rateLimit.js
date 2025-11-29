import rateLimit from "express-rate-limit";
import {env} from "../config/env.js";

export const roadmapLimiter = rateLimit({
    windowMs: env.ROADMAP_RATE_LIMIT_WINDOW_MS,
    max: env.ROADMAP_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: {code: "TOO_MANY_REQUESTS", message: "Too many roadmap aggregation requests"}}
});

export const webhookLimiter = rateLimit({
    windowMs: env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
    max: env.WEBHOOK_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: {code: "TOO_MANY_REQUESTS", message: "Too many webhook operations"}}
});
