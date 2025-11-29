import {env} from "../config/env.js";
import {createHttp} from "../utils/http.js";
import {badRequest, internal, notFound} from "../utils/httpError.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);
const baseUrl = env.HIVE_BASE_URL.replace(/\/+$/, "");

function organizationUrl() {
    return `${baseUrl}/api/v1/organization`;
}

function submissionUrl() {
    return `${baseUrl}/api/v1/submission`;
}

function normalizeStatus(s) {
    return {
        id: s.id, name: s.name, color: s.color, type: s.type, isDefault: Boolean(s.isDefault)
    };
}

function normalizeRoadmap(raw) {
    return {
        id: raw._id,
        name: raw.name,
        slug: raw.slug,
        description: raw.description || "",
        color: raw.color,
        items: Array.isArray(raw.items) ? raw.items.map(x => ({
            id: x._id, title: x.title, color: x.color, icon: x.icon || null, filter: x.filter
        })) : []
    };
}

function normalizeSubmission(raw) {
    const translations = raw.contentTranslations || {};
    const languages = Object.keys(translations);
    const status = raw.postStatus || {};
    const category = raw.postCategory || {};
    const tags = Array.isArray(raw.postTags) ? raw.postTags : [];
    const urlSlug = raw.slug || "";
    const publicUrl = urlSlug ? `${baseUrl}/en/p/${encodeURIComponent(urlSlug)}` : null;
    return {
        id: raw.id, slug: raw.slug, title: raw.title, status: {
            id: status.id,
            name: status.name,
            color: status.color,
            type: status.type,
            isDefault: Boolean(status.isDefault)
        }, category: {
            id: category.id,
            key: category.category,
            name: category.name && category.name.en ? category.name.en : category.category,
            private: Boolean(category.private)
        }, tags: tags.map(t => ({
            id: t.id, name: t.name, color: t.color, private: Boolean(t.private)
        })), organizationSlug: raw.organization, upvotes: raw.upvotes, eta: raw.eta || null, stats: {
            upvotes: raw.upvotes, comments: raw.commentCount || 0, mergedSubmissions: raw.mergedSubmissionCount || 0
        }, timestamps: {
            createdAt: raw.date,
            lastModified: raw.lastModified,
            stalePostDate: raw.stalePostDate || null,
            lastUpvoted: raw.lastUpvoted || null
        }, translations: {
            count: languages.length, languages
        }, urls: {
            public: publicUrl, api: `${submissionUrl()}?id=${encodeURIComponent(raw.id)}`
        }, meta: {
            categoryId: raw.categoryId,
            inReview: Boolean(raw.inReview),
            isSpam: Boolean(raw.isSpam),
            pinned: Boolean(raw.pinned),
            sourceLanguage: raw.contentSourceLanguage,
            sourceLanguageHash: raw.contentSourceLanguageHash
        }, raw
    };
}

export async function getOrganization() {
    try {
        const {data} = await http.get(organizationUrl(), {
            headers: {Accept: "application/json"}
        });
        return data;
    } catch (err) {
        throw internal("Failed to fetch organization", err.response?.data || err.message);
    }
}

async function fetchSubmissionPage({
                                       statusId,
                                       sortBy = "upvotes:desc",
                                       inReview = false,
                                       includePinned = true,
                                       page = 1
                                   }) {
    if (!statusId) throw badRequest("statusId is required");
    try {
        const {data} = await http.get(submissionUrl(), {
            params: {
                s: statusId, sortBy, inReview, includePinned, page
            }, headers: {Accept: "application/json"}
        });
        return data;
    } catch (err) {
        throw internal("Failed to fetch submissions page", err.response?.data || err.message);
    }
}

async function fetchAllSubmissionsForStatus({statusId, sortBy, inReview, includePinned}) {
    const first = await fetchSubmissionPage({statusId, sortBy, inReview, includePinned, page: 1});
    const results = Array.isArray(first.results) ? first.results.slice() : [];
    const totalPages = first.totalPages || 1;
    const limit = first.limit || results.length || 0;
    if (totalPages > 1) {
        const tasks = [];
        for (let p = 2; p <= totalPages; p++) {
            tasks.push(fetchSubmissionPage({statusId, sortBy, inReview, includePinned, page: p}));
        }
        const pages = await Promise.all(tasks);
        for (const page of pages) {
            if (Array.isArray(page.results)) {
                for (const item of page.results) results.push(item);
            }
        }
    }
    return {
        items: results, pageSize: limit, totalPages, totalResults: first.totalResults || results.length
    };
}

export async function getRoadmapMetadata() {
    const org = await getOrganization();
    const statuses = Array.isArray(org.postStatuses) ? org.postStatuses.map(normalizeStatus) : [];
    const roadmaps = Array.isArray(org.roadmaps) ? org.roadmaps.map(normalizeRoadmap) : [];
    return {
        organization: {
            id: org.id,
            slug: org.name,
            displayName: org.displayName,
            color: org.color,
            baseUrl: baseUrl,
            language: org.language,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt
        }, statuses, roadmaps
    };
}

export async function getStatusItems(statusId, {sortBy = "upvotes:desc", inReview = false, includePinned = true} = {}) {
    const meta = await getRoadmapMetadata();
    const status = meta.statuses.find(s => s.id === statusId);
    if (!status) throw notFound("Status not found", {statusId});
    const pageData = await fetchAllSubmissionsForStatus({statusId, sortBy, inReview, includePinned});
    const normalizedItems = pageData.items.map(normalizeSubmission);
    const totalsByCategory = {};
    for (const item of normalizedItems) {
        const key = item.category.key || "unknown";
        if (!totalsByCategory[key]) {
            totalsByCategory[key] = {key, name: item.category.name, count: 0};
        }
        totalsByCategory[key].count += 1;
    }
    return {
        organization: meta.organization, status, totals: {
            totalItems: normalizedItems.length,
            totalResults: pageData.totalResults,
            totalPages: pageData.totalPages,
            pageSize: pageData.pageSize,
            categories: Object.values(totalsByCategory).sort((a, b) => b.count - a.count)
        }, items: normalizedItems, generatedAt: new Date().toISOString()
    };
}

export async function getAggregateRoadmap({
                                              includeCompleted = true,
                                              sortBy = "upvotes:desc",
                                              inReview = false,
                                              includePinned = true
                                          } = {}) {
    const meta = await getRoadmapMetadata();
    const statuses = includeCompleted ? meta.statuses : meta.statuses.filter(s => s.type !== "completed");
    const tasks = statuses.map(s => fetchAllSubmissionsForStatus({
        statusId: s.id,
        sortBy,
        inReview,
        includePinned
    }).then(pageData => ({
        status: s, pageData
    })));
    const pages = await Promise.all(tasks);
    const statusBlocks = [];
    let totalItems = 0;
    let totalResults = 0;
    for (const {status, pageData} of pages) {
        const normalizedItems = pageData.items.map(normalizeSubmission);
        totalItems += normalizedItems.length;
        totalResults += pageData.totalResults || normalizedItems.length;
        statusBlocks.push({
            status, totals: {
                totalItems: normalizedItems.length,
                totalResults: pageData.totalResults,
                totalPages: pageData.totalPages,
                pageSize: pageData.pageSize
            }, items: normalizedItems
        });
    }
    return {
        organization: meta.organization, totals: {
            statuses: statusBlocks.length, items: totalItems, results: totalResults
        }, statuses: statusBlocks, generatedAt: new Date().toISOString()
    };
}

export async function getSubmissionById(id) {
    if (!id) throw badRequest("id is required");
    try {
        const {data} = await http.get(submissionUrl(), {
            params: {id}, headers: {Accept: "application/json"}
        });
        if (data && Array.isArray(data.results) && data.results.length > 0) {
            return normalizeSubmission(data.results[0]);
        }
        throw notFound("Submission not found", {id});
    } catch (err) {
        const status = err.response?.status || 0;
        if (status === 404) {
            throw notFound("Submission not found", {id});
        }
        if (err.code === "NOT_FOUND") throw err;
        throw internal("Failed to fetch submission", err.response?.data || err.message);
    }
}

export function buildPublicSlugUrl(slug) {
    if (!slug) throw badRequest("slug is required");
    return `${baseUrl}/en/p/${encodeURIComponent(slug)}`;
}
