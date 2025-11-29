import express from "express";
import Joi from "joi";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {
    createWebhook,
    deleteWebhook,
    getWebhook,
    listWebhooks,
    triggerTestWebhook
} from "../services/webhook.service.js";
import {webhookLimiter} from "../middleware/rateLimit.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
    const items = listWebhooks();
    res.json({
        count: items.length, webhooks: items
    });
}));

router.post("/", webhookLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        url: Joi.string().uri().required(),
        events: Joi.array().items(Joi.string()).default(["roadmap.status.snapshot"]),
        secret: Joi.string().min(8).optional(),
        active: Joi.boolean().optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const webhook = createWebhook(value);
    res.status(201).json({webhook});
}));

router.get("/:id", asyncHandler(async (req, res) => {
    const webhook = getWebhook(req.params.id);
    res.json({webhook});
}));

router.delete("/:id", webhookLimiter, asyncHandler(async (req, res) => {
    const result = deleteWebhook(req.params.id);
    res.json(result);
}));

router.post("/:id/test", webhookLimiter, asyncHandler(async (req, res) => {
    const webhook = await triggerTestWebhook(req.params.id);
    res.json({
        ok: true, webhook
    });
}));

export default router;
