import {createHmac, randomUUID} from "node:crypto";
import {isIP} from "node:net";
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

function isPrivateIpv4(ip) {
    const parts = ip.split(".").map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) {
        return false;
    }
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    return false;
}

function isPrivateIpv6(ip) {
    const lower = ip.toLowerCase();
    // loopback
    if (lower === "::1") return true;
    // unique local addresses fc00::/7 (fc00, fdxx)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // link-local fe80::/10
    if (lower.startsWith("fe80")) return true;
    return false;
}

function isPrivateIp(ip) {
    if (!ip) return false;
    if (ip.includes(".")) {
        return isPrivateIpv4(ip);
    }
    return isPrivateIpv6(ip);
}

function isLocalHostname(host) {
    const lower = String(host || "").toLowerCase();
    if (!lower) return false;
    if (lower === "localhost") return true;
    if (lower.endsWith(".localhost")) return true;
    return false;
}

function validateWebhookUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw badRequest("Invalid webhook URL");
    }

    const protocol = parsed.protocol;
    if (protocol !== "http:" && protocol !== "https:") {
        throw badRequest("Webhook URL must use http or https");
    }

    const hostname = parsed.hostname;
    if (isLocalHostname(hostname)) {
        throw badRequest("Webhook URL host not allowed");
    }

    const ipType = isIP(hostname);
    if (ipType && isPrivateIp(hostname)) {
        throw badRequest("Webhook URL IP not allowed");
    }
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
    validateWebhookUrl(url);

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
