import {createHmac, randomUUID} from "node:crypto";
import {env} from "../config/env.js";
import {createHttp} from "../utils/http.js";
import {badRequest, notFound} from "../utils/httpError.js";

const http = createHttp(env.WEBHOOK_HTTP_TIMEOUT_MS);
const store = new Map();

function sanitizeWebhook(w) {
    return {
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt,
        lastSuccessAt: w.lastSuccessAt || null,
        lastErrorAt: w.lastErrorAt || null,
        lastError: w.lastError || null
    };
}

export function listWebhooks() {
    return Array.from(store.values()).map(sanitizeWebhook);
}

export function getWebhook(id) {
    const w = store.get(id);
    if (!w) throw notFound("Webhook not found", {id});
    return sanitizeWebhook(w);
}

export function createWebhook({url, events, secret, active = true}) {
    if (!url) throw badRequest("url is required");
    const id = randomUUID();
    const w = {
        id,
        url,
        events: Array.isArray(events) && events.length > 0 ? events.slice() : ["roadmap.status.snapshot"],
        secret: secret && secret.length >= 8 ? secret : env.WEBHOOK_DEFAULT_SECRET,
        active: Boolean(active),
        createdAt: new Date().toISOString(),
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null
    };
    store.set(id, w);
    return sanitizeWebhook(w);
}

export function deleteWebhook(id) {
    const exists = store.has(id);
    if (!exists) throw notFound("Webhook not found", {id});
    store.delete(id);
    return {deleted: true, id};
}

async function sendWebhook(w, type, payload) {
    const body = {
        id: randomUUID(), type, timestamp: new Date().toISOString(), payload
    };
    const raw = JSON.stringify(body);
    const signature = createHmac("sha256", w.secret).update(raw).digest("hex");
    try {
        await http.post(w.url, body, {
            headers: {
                "content-type": "application/json",
                "user-agent": "hive-roadmap-api-webhook/1.0",
                "x-hive-roadmap-event": type,
                "x-hive-roadmap-signature": `sha256=${signature}`
            }
        });
        w.lastSuccessAt = new Date().toISOString();
        w.lastErrorAt = null;
        w.lastError = null;
    } catch (err) {
        w.lastErrorAt = new Date().toISOString();
        const msg = err.response?.data || err.message || "Unknown webhook error";
        w.lastError = typeof msg === "string" ? msg : JSON.stringify(msg);
    }
}

export async function dispatchEvent(type, payload) {
    const tasks = [];
    for (const w of store.values()) {
        if (!w.active) continue;
        if (!Array.isArray(w.events) || w.events.length === 0) continue;
        if (!w.events.includes(type) && !w.events.includes("*")) continue;
        tasks.push(sendWebhook(w, type, payload));
    }
    if (tasks.length === 0) return {dispatched: 0};
    await Promise.allSettled(tasks);
    return {dispatched: tasks.length};
}

export async function triggerTestWebhook(id) {
    const w = store.get(id);
    if (!w) throw notFound("Webhook not found", {id});
    await sendWebhook(w, "webhook.test", {message: "test"});
    return sanitizeWebhook(w);
}

export async function broadcastStatusSnapshot(snapshot) {
    return dispatchEvent("roadmap.status.snapshot", snapshot);
}

export async function broadcastAggregateSnapshot(snapshot) {
    return dispatchEvent("roadmap.aggregate.snapshot", snapshot);
}
