import express from "express";
import Joi from "joi";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {
    buildPublicSlugUrl,
    getAggregateRoadmap,
    getOrganization,
    getRoadmapMetadata,
    getStatusItems,
    getSubmissionById
} from "../services/hive.service.js";
import {roadmapLimiter} from "../middleware/rateLimit.js";
import {broadcastAggregateSnapshot, broadcastStatusSnapshot} from "../services/webhook.service.js";

const router = express.Router();

router.get("/organization", asyncHandler(async (req, res) => {
    const org = await getOrganization();
    res.json({
        organization: {
            id: org.id,
            slug: org.name,
            displayName: org.displayName,
            color: org.color,
            baseUrl: org.customDomain ? `https://${org.customDomain}` : null,
            language: org.language,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
            roadmapStatuses: org.roadmapStatuses,
            postStatuses: org.postStatuses,
            roadmaps: org.roadmaps
        }
    });
}));

router.get("/meta", asyncHandler(async (req, res) => {
    const meta = await getRoadmapMetadata();
    res.json(meta);
}));

router.get("/statuses", asyncHandler(async (req, res) => {
    const meta = await getRoadmapMetadata();
    res.json({
        count: meta.statuses.length, statuses: meta.statuses
    });
}));

router.get("/status/:statusId/items", asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sortBy: Joi.string().default("upvotes:desc"),
        inReview: Joi.boolean().truthy("true").falsy("false").default(false),
        includePinned: Joi.boolean().truthy("true").falsy("false").default(true),
        broadcast: Joi.boolean().truthy("true").falsy("false").default(false)
    });
    const {value, error} = schema.validate(req.query || {});
    if (error) throw badRequest(error.message);
    const snapshot = await getStatusItems(req.params.statusId, {
        sortBy: value.sortBy, inReview: value.inReview, includePinned: value.includePinned
    });
    if (value.broadcast) {
        broadcastStatusSnapshot(snapshot).catch(() => {
        });
    }
    res.json(snapshot);
}));

router.get("/aggregate", roadmapLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        includeCompleted: Joi.boolean().truthy("true").falsy("false").default(true),
        sortBy: Joi.string().default("upvotes:desc"),
        inReview: Joi.boolean().truthy("true").falsy("false").default(false),
        includePinned: Joi.boolean().truthy("true").falsy("false").default(true),
        broadcast: Joi.boolean().truthy("true").falsy("false").default(false)
    });
    const {value, error} = schema.validate(req.query || {});
    if (error) throw badRequest(error.message);
    const snapshot = await getAggregateRoadmap({
        includeCompleted: value.includeCompleted,
        sortBy: value.sortBy,
        inReview: value.inReview,
        includePinned: value.includePinned
    });
    if (value.broadcast) {
        broadcastAggregateSnapshot(snapshot).catch(() => {
        });
    }
    res.json(snapshot);
}));

router.get("/item/:id", asyncHandler(async (req, res) => {
    const item = await getSubmissionById(req.params.id);
    res.json({item});
}));

router.get("/item/by-slug/:slug", asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) throw badRequest("slug is required");
    const url = buildPublicSlugUrl(slug);
    res.json({
        slug, url
    });
}));

export default router;
