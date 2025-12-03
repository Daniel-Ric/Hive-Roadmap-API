import swaggerJSDoc from "swagger-jsdoc";
import {env} from "../config/env.js";

const serverUrl = env.SWAGGER_SERVER_URL || `http://localhost:${env.PORT}`;

const options = {
    definition: {
        openapi: "3.0.3", info: {
            title: "Hive Roadmap Aggregator API",
            version: "1.1.0",
            description: "High-level REST API over The Hive roadmap (Featurebase) with aggregation, structured responses and webhook dispatch.\n\n"
        }, servers: [{
            url: serverUrl, description: env.NODE_ENV
        }], tags: [{
            name: "Health", description: "Service readiness, liveness and basic diagnostics."
        }, {
            name: "Roadmap Meta",
            description: "Static metadata about the Hive organization, statuses and roadmap configuration."
        }, {
            name: "Roadmap Status", description: "Operations for working with individual roadmap statuses."
        }, {
            name: "Roadmap Aggregation", description: "High-level aggregated snapshots across multiple statuses."
        }, {
            name: "Roadmap Items", description: "Access to individual roadmap items and public URLs."
        }, {
            name: "Webhooks", description: "Webhook registration, inspection and testing for roadmap events."
        }], components: {
            schemas: {
                ErrorResponse: {
                    type: "object", properties: {
                        error: {
                            type: "object", properties: {
                                code: {type: "string"},
                                message: {type: "string"},
                                details: {type: "object"},
                                stack: {type: "string"}
                            }, required: ["code", "message"]
                        }
                    }, required: ["error"]
                }, OrganizationSummary: {
                    type: "object", properties: {
                        organization: {
                            type: "object", properties: {
                                id: {type: "string"},
                                slug: {
                                    type: "string",
                                    description: "Internal organization slug, for example hivegameslimited"
                                },
                                displayName: {type: "string", example: "The Hive"},
                                color: {type: "string", example: "#4652f2"},
                                baseUrl: {
                                    type: "string",
                                    nullable: true,
                                    description: "Public updates portal base URL when available"
                                },
                                language: {type: "string", example: "en"},
                                createdAt: {type: "string", format: "date-time"},
                                updatedAt: {type: "string", format: "date-time"},
                                roadmapStatuses: {
                                    type: "array",
                                    items: {type: "string"},
                                    description: "Simple list of human readable roadmap columns, for example In Review, In Progress, Completed"
                                },
                                postStatuses: {
                                    type: "array", items: {
                                        type: "object", additionalProperties: true
                                    }, description: "Raw postStatuses array as returned by upstream"
                                },
                                roadmaps: {
                                    type: "array", items: {
                                        type: "object", additionalProperties: true
                                    }, description: "Raw roadmaps definition as returned by upstream"
                                }
                            }, required: ["id", "slug", "displayName"]
                        }
                    }, required: ["organization"]
                }, RoadmapStatus: {
                    type: "object", properties: {
                        id: {type: "string", example: "673d43a8b479f2dff6f8b74b"},
                        name: {type: "string", example: "Coming Next..."},
                        color: {type: "string", example: "Yellow"},
                        type: {type: "string", example: "active"},
                        isDefault: {type: "boolean", example: false}
                    }, required: ["id", "name", "type"]
                }, RoadmapConfig: {
                    type: "object", properties: {
                        organization: {
                            $ref: "#/components/schemas/OrganizationSummary/properties/organization"
                        }, statuses: {
                            type: "array", items: {$ref: "#/components/schemas/RoadmapStatus"}
                        }, roadmaps: {
                            type: "array", items: {
                                type: "object", properties: {
                                    id: {type: "string"},
                                    name: {type: "string"},
                                    slug: {type: "string"},
                                    description: {type: "string"},
                                    color: {type: "string"},
                                    items: {
                                        type: "array", items: {
                                            type: "object", properties: {
                                                id: {type: "string"},
                                                title: {type: "string"},
                                                color: {type: "string"},
                                                icon: {
                                                    type: "object", nullable: true, additionalProperties: true
                                                },
                                                filter: {
                                                    type: "string",
                                                    description: "Encoded query string used against the Featurebase submission API"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }, required: ["organization", "statuses", "roadmaps"]
                }, RoadmapStatusList: {
                    type: "object", properties: {
                        count: {type: "integer", example: 3}, statuses: {
                            type: "array", items: {$ref: "#/components/schemas/RoadmapStatus"}
                        }
                    }, required: ["count", "statuses"]
                }, RoadmapItemCategory: {
                    type: "object", properties: {
                        id: {type: "string"},
                        key: {type: "string", description: "Internal category key, for example Minigames"},
                        name: {type: "string", description: "Localized human readable category name"},
                        private: {type: "boolean"}
                    }
                }, RoadmapItemStatusRef: {
                    type: "object", properties: {
                        id: {type: "string"},
                        name: {type: "string"},
                        color: {type: "string"},
                        type: {type: "string"},
                        isDefault: {type: "boolean"}
                    }
                }, RoadmapItemTag: {
                    type: "object", properties: {
                        id: {type: "string"},
                        name: {type: "string"},
                        color: {type: "string"},
                        private: {type: "boolean"}
                    }
                }, RoadmapItemStats: {
                    type: "object", properties: {
                        upvotes: {type: "integer"}, comments: {type: "integer"}, mergedSubmissions: {type: "integer"}
                    }
                }, RoadmapItemTimestamps: {
                    type: "object", properties: {
                        createdAt: {type: "string", format: "date-time"},
                        lastModified: {type: "string", format: "date-time"},
                        stalePostDate: {type: "string", format: "date-time", nullable: true},
                        lastUpvoted: {type: "string", format: "date-time", nullable: true}
                    }
                }, RoadmapItemMeta: {
                    type: "object", properties: {
                        categoryId: {type: "string"},
                        inReview: {type: "boolean"},
                        isSpam: {type: "boolean"},
                        pinned: {type: "boolean"},
                        sourceLanguage: {type: "string"},
                        sourceLanguageHash: {type: "string"}
                    }
                }, RoadmapItemUrls: {
                    type: "object", properties: {
                        public: {
                            type: "string",
                            nullable: true,
                            description: "Public updates.playhive.com URL to view the card"
                        }, api: {
                            type: "string", description: "Internal API URL used by this service or upstream"
                        }
                    }
                }, RoadmapItem: {
                    type: "object", properties: {
                        id: {type: "string"},
                        slug: {type: "string"},
                        title: {type: "string"},
                        status: {$ref: "#/components/schemas/RoadmapItemStatusRef"},
                        category: {$ref: "#/components/schemas/RoadmapItemCategory"},
                        tags: {
                            type: "array", items: {$ref: "#/components/schemas/RoadmapItemTag"}
                        },
                        organizationSlug: {type: "string"},
                        upvotes: {type: "integer"},
                        eta: {type: "string", format: "date-time", nullable: true},
                        stats: {$ref: "#/components/schemas/RoadmapItemStats"},
                        timestamps: {$ref: "#/components/schemas/RoadmapItemTimestamps"},
                        translations: {
                            type: "object", properties: {
                                count: {type: "integer"}, languages: {
                                    type: "array", items: {type: "string"}
                                }
                            }
                        },
                        urls: {$ref: "#/components/schemas/RoadmapItemUrls"},
                        meta: {$ref: "#/components/schemas/RoadmapItemMeta"},
                        raw: {
                            type: "object", additionalProperties: true, description: "Full upstream submission payload"
                        }
                    }, required: ["id", "slug", "title", "status", "category", "stats", "timestamps", "urls", "meta"]
                }, StatusItemsSnapshot: {
                    type: "object", properties: {
                        organization: {
                            $ref: "#/components/schemas/OrganizationSummary/properties/organization"
                        }, status: {$ref: "#/components/schemas/RoadmapStatus"}, totals: {
                            type: "object", properties: {
                                totalItems: {type: "integer"},
                                totalResults: {type: "integer"},
                                totalPages: {type: "integer"},
                                pageSize: {type: "integer"},
                                categories: {
                                    type: "array",
                                    description: "Aggregated counts by category within this status",
                                    items: {
                                        type: "object", properties: {
                                            key: {type: "string"}, name: {type: "string"}, count: {type: "integer"}
                                        }
                                    }
                                }
                            }
                        }, items: {
                            type: "array", items: {$ref: "#/components/schemas/RoadmapItem"}
                        }, generatedAt: {type: "string", format: "date-time"}
                    }, required: ["organization", "status", "totals", "items", "generatedAt"]
                }, AggregateStatusBlock: {
                    type: "object", properties: {
                        status: {$ref: "#/components/schemas/RoadmapStatus"}, totals: {
                            type: "object", properties: {
                                totalItems: {type: "integer"},
                                totalResults: {type: "integer"},
                                totalPages: {type: "integer"},
                                pageSize: {type: "integer"}
                            }
                        }, items: {
                            type: "array", items: {$ref: "#/components/schemas/RoadmapItem"}
                        }
                    }
                }, AggregateSnapshot: {
                    type: "object", properties: {
                        organization: {
                            $ref: "#/components/schemas/OrganizationSummary/properties/organization"
                        }, totals: {
                            type: "object", properties: {
                                statuses: {type: "integer"}, items: {type: "integer"}, results: {type: "integer"}
                            }
                        }, statuses: {
                            type: "array", items: {$ref: "#/components/schemas/AggregateStatusBlock"}
                        }, generatedAt: {type: "string", format: "date-time"}
                    }, required: ["organization", "totals", "statuses", "generatedAt"]
                }, Webhook: {
                    type: "object", properties: {
                        id: {type: "string", format: "uuid"},
                        url: {type: "string", format: "uri"},
                        events: {
                            type: "array",
                            items: {type: "string"},
                            description: "Subscribed event types, for example roadmap.status.snapshot, roadmap.aggregate.snapshot or *"
                        },
                        active: {type: "boolean"},
                        createdAt: {type: "string", format: "date-time"},
                        lastSuccessAt: {type: "string", format: "date-time", nullable: true},
                        lastErrorAt: {type: "string", format: "date-time", nullable: true},
                        lastError: {type: "string", nullable: true}
                    }, required: ["id", "url", "events", "active", "createdAt"]
                }, WebhookListResponse: {
                    type: "object", properties: {
                        count: {type: "integer"}, webhooks: {
                            type: "array", items: {$ref: "#/components/schemas/Webhook"}
                        }
                    }, required: ["count", "webhooks"]
                }, WebhookCreateRequest: {
                    type: "object", required: ["url"], properties: {
                        url: {type: "string", format: "uri"}, events: {
                            type: "array",
                            items: {type: "string"},
                            description: "List of event types, for example roadmap.status.snapshot, roadmap.aggregate.snapshot or *"
                        }, secret: {
                            type: "string",
                            description: "Optional HMAC secret used to sign requests using SHA-256",
                            minLength: 8
                        }, active: {
                            type: "boolean", description: "Whether the webhook is active immediately after creation"
                        }
                    }, example: {
                        url: "https://example.com/hive-webhook",
                        events: ["roadmap.status.snapshot", "roadmap.aggregate.snapshot"],
                        secret: "my-very-strong-secret",
                        active: true
                    }
                }, WebhookCreateResponse: {
                    type: "object", properties: {
                        webhook: {$ref: "#/components/schemas/Webhook"}
                    }, required: ["webhook"]
                }, WebhookDeleteResponse: {
                    type: "object", properties: {
                        deleted: {type: "boolean"}, id: {type: "string"}
                    }, required: ["deleted", "id"]
                }, WebhookTestResponse: {
                    type: "object", properties: {
                        ok: {type: "boolean"}, webhook: {$ref: "#/components/schemas/Webhook"}
                    }, required: ["ok", "webhook"]
                }, PublicSlugResolution: {
                    type: "object", properties: {
                        slug: {type: "string"}, url: {
                            type: "string",
                            format: "uri",
                            description: "Resolved public URL that can be opened in a browser"
                        }
                    }, required: ["slug", "url"]
                }, SingleItemResponse: {
                    type: "object", properties: {
                        item: {$ref: "#/components/schemas/RoadmapItem"}
                    }, required: ["item"]
                }
            }
        }, security: [], paths: {
            "/healthz": {
                get: {
                    tags: ["Health"],
                    operationId: "getHealthz",
                    summary: "Liveness probe",
                    description: "Returns a simple payload indicating the service process is up.",
                    security: [],
                    responses: {
                        200: {
                            description: "Service is alive", content: {
                                "application/json": {
                                    schema: {
                                        type: "object", properties: {
                                            ok: {type: "boolean"}
                                        }
                                    }, example: {ok: true}
                                }
                            }
                        }
                    }
                }
            }, "/readyz": {
                get: {
                    tags: ["Health"],
                    operationId: "getReadyz",
                    summary: "Readiness probe",
                    description: "Signals that the service is ready to accept traffic at a basic level.",
                    security: [],
                    responses: {
                        200: {
                            description: "Service is ready", content: {
                                "application/json": {
                                    schema: {
                                        type: "object", properties: {
                                            ready: {type: "boolean"}
                                        }
                                    }, example: {ready: true}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/organization": {
                get: {
                    tags: ["Roadmap Meta"],
                    operationId: "getOrganizationSnapshot",
                    summary: "Get raw organization snapshot",
                    description: "Fetches the upstream organization document from Featurebase and extracts key roadmap-related fields.\n\n" + "Use this endpoint when you want a view that is close to the source data for debugging or exploration.",
                    responses: {
                        200: {
                            description: "Organization payload with roadmap configuration", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/OrganizationSummary"}
                                }
                            }
                        }, 500: {
                            description: "Failed to fetch organization", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/meta": {
                get: {
                    tags: ["Roadmap Meta"],
                    operationId: "getRoadmapMeta",
                    summary: "Get roadmap metadata",
                    description: "Returns a normalized snapshot of the Hive roadmap configuration including:\n" + "- Organization summary\n" + "- Full list of postStatuses\n" + "- Roadmap definitions (columns and filters)",
                    responses: {
                        200: {
                            description: "Roadmap metadata snapshot", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/RoadmapConfig"}
                                }
                            }
                        }, 500: {
                            description: "Failed to build roadmap metadata snapshot", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/statuses": {
                get: {
                    tags: ["Roadmap Status"],
                    operationId: "listRoadmapStatuses",
                    summary: "List roadmap statuses",
                    description: "Returns all roadmap post statuses, including canonical IDs for the Featurebase submission API, color and type.\n\n" + "These IDs can be used directly with `GET /roadmap/status/{statusId}/items`.",
                    responses: {
                        200: {
                            description: "List of roadmap statuses", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/RoadmapStatusList"}
                                }
                            }
                        }, 500: {
                            description: "Failed to fetch roadmap statuses", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/status/{statusId}/items": {
                get: {
                    tags: ["Roadmap Status"],
                    operationId: "getStatusItems",
                    summary: "Get items for a single status",
                    description: "Aggregates all pages for a given roadmap status and returns a normalized snapshot of all items.\n\n" + "Pagination is handled internally using the upstream `page` parameter. The response includes per-category totals and rich item metadata, " + "suitable for dashboards, bots or analytics.\n\n" + "If `broadcast=true` is specified, a `roadmap.status.snapshot` webhook event is dispatched after the snapshot is generated.",
                    parameters: [{
                        in: "path",
                        name: "statusId",
                        required: true,
                        schema: {type: "string"},
                        description: "Status id from organization.postStatuses (for example 673d43a8b479f2dff6f8b74b)"
                    }, {
                        in: "query",
                        name: "sortBy",
                        required: false,
                        schema: {type: "string", default: "upvotes:desc"},
                        description: "Sort expression understood by the upstream Featurebase submission API"
                    }, {
                        in: "query",
                        name: "inReview",
                        required: false,
                        schema: {type: "boolean", default: false},
                        description: "If true, filters to in-review posts only"
                    }, {
                        in: "query",
                        name: "includePinned",
                        required: false,
                        schema: {type: "boolean", default: true},
                        description: "If false, pinned posts are excluded from the snapshot"
                    }, {
                        in: "query",
                        name: "broadcast",
                        required: false,
                        schema: {type: "boolean", default: false},
                        description: "If true, emits a webhook event with the status snapshot"
                    }],
                    responses: {
                        200: {
                            description: "Status snapshot including items and totals", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/StatusItemsSnapshot"}
                                }
                            }
                        }, 404: {
                            description: "Status id not found", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 500: {
                            description: "Failed to fetch or aggregate items for the given status", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/aggregate": {
                get: {
                    tags: ["Roadmap Aggregation"],
                    operationId: "getAggregateRoadmap",
                    summary: "Aggregate all roadmap statuses",
                    description: "Aggregates all roadmap statuses into a single snapshot.\n\n" + "For each status, the service will:\n" + "- Walk all pages of the upstream submission API\n" + "- Normalize every item\n" + "- Attach per-status totals and global totals\n\n" + "If `broadcast=true` is specified, a `roadmap.aggregate.snapshot` webhook event is dispatched.",
                    parameters: [{
                        in: "query",
                        name: "includeCompleted",
                        required: false,
                        schema: {type: "boolean", default: true},
                        description: "If false, statuses with type=completed are excluded from the aggregate snapshot"
                    }, {
                        in: "query",
                        name: "sortBy",
                        required: false,
                        schema: {type: "string", default: "upvotes:desc"},
                        description: "Sort expression understood by the upstream submission API"
                    }, {
                        in: "query",
                        name: "inReview",
                        required: false,
                        schema: {type: "boolean", default: false},
                        description: "If true, filters to in-review posts only"
                    }, {
                        in: "query",
                        name: "includePinned",
                        required: false,
                        schema: {type: "boolean", default: true},
                        description: "If false, pinned posts are excluded from all status blocks"
                    }, {
                        in: "query",
                        name: "broadcast",
                        required: false,
                        schema: {type: "boolean", default: false},
                        description: "If true, emits a webhook event with the aggregate snapshot"
                    }],
                    responses: {
                        200: {
                            description: "Aggregate snapshot of all statuses", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/AggregateSnapshot"}
                                }
                            }
                        }, 429: {
                            description: "Too many aggregate requests in the configured time window", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 500: {
                            description: "Failed to build aggregate snapshot", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/item/{id}": {
                get: {
                    tags: ["Roadmap Items"],
                    operationId: "getRoadmapItemById",
                    summary: "Get a single roadmap item by id",
                    description: "Fetches a single roadmap item from the upstream API using its internal id and returns a normalized view.\n\n" + "Use this when you already know the internal submission id and want detailed metadata including the raw upstream payload.",
                    parameters: [{
                        in: "path",
                        name: "id",
                        required: true,
                        schema: {type: "string"},
                        description: "Featurebase submission id"
                    }],
                    responses: {
                        200: {
                            description: "Single roadmap item", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/SingleItemResponse"}
                                }
                            }
                        }, 404: {
                            description: "Item not found", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 500: {
                            description: "Failed to fetch or normalize item", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/roadmap/item/by-slug/{slug}": {
                get: {
                    tags: ["Roadmap Items"],
                    operationId: "resolvePublicUrlBySlug",
                    summary: "Resolve public URL for a roadmap item by slug",
                    description: "Resolves the public updates.playhive.com URL for a given card slug.\n\n" + "This endpoint does not contact the upstream API; it simply generates the URL using configuration and the provided slug.",
                    parameters: [{
                        in: "path",
                        name: "slug",
                        required: true,
                        schema: {type: "string"},
                        description: "Submission slug, for example bedwars-season-4"
                    }],
                    responses: {
                        200: {
                            description: "Resolved public URL", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/PublicSlugResolution"}, example: {
                                        slug: "bedwars-season-4",
                                        url: "https://updates.playhive.com/en/p/bedwars-season-4"
                                    }
                                }
                            }
                        }, 400: {
                            description: "Missing or invalid slug", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/webhooks": {
                get: {
                    tags: ["Webhooks"],
                    operationId: "listWebhooks",
                    summary: "List webhooks",
                    description: "Returns all registered webhooks in the current process.\n\n" + "Note: webhooks are stored in-memory only. Restarting the process will clear all registrations.",
                    responses: {
                        200: {
                            description: "List of webhooks", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/WebhookListResponse"}
                                }
                            }
                        }
                    }
                }, post: {
                    tags: ["Webhooks"],
                    operationId: "createWebhook",
                    summary: "Create webhook",
                    description: "Registers a new webhook for roadmap events.\n\n" + "Supported event types include:\n" + "- `roadmap.status.snapshot`\n" + "- `roadmap.aggregate.snapshot`\n" + "- `webhook.test`\n" + "- `*` (subscribe to all events)\n\n" + "Requests are signed using an `x-hive-roadmap-signature` header with `sha256=<hex-hmac>` using the provided secret or the default secret.",
                    requestBody: {
                        required: true, content: {
                            "application/json": {
                                schema: {$ref: "#/components/schemas/WebhookCreateRequest"}
                            }
                        }
                    },
                    responses: {
                        201: {
                            description: "Created webhook", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/WebhookCreateResponse"}
                                }
                            }
                        }, 400: {
                            description: "Validation error when creating webhook", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 429: {
                            description: "Webhook creation rate limit exceeded", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/webhooks/{id}": {
                get: {
                    tags: ["Webhooks"],
                    operationId: "getWebhook",
                    summary: "Get webhook",
                    description: "Returns a single webhook by id, including its last delivery timestamps and error information.",
                    parameters: [{
                        in: "path", name: "id", required: true, schema: {type: "string"}
                    }],
                    responses: {
                        200: {
                            description: "Webhook", content: {
                                "application/json": {
                                    schema: {
                                        type: "object", properties: {
                                            webhook: {$ref: "#/components/schemas/Webhook"}
                                        }, required: ["webhook"]
                                    }
                                }
                            }
                        }, 404: {
                            description: "Webhook not found", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }, delete: {
                    tags: ["Webhooks"],
                    operationId: "deleteWebhook",
                    summary: "Delete webhook",
                    description: "Deletes a webhook by id. Subsequent events will no longer be delivered to this URL from this API instance.",
                    parameters: [{
                        in: "path", name: "id", required: true, schema: {type: "string"}
                    }],
                    responses: {
                        200: {
                            description: "Webhook deleted", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/WebhookDeleteResponse"}
                                }
                            }
                        }, 404: {
                            description: "Webhook not found", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 429: {
                            description: "Webhook deletion rate limit exceeded", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }, "/webhooks/{id}/test": {
                post: {
                    tags: ["Webhooks"],
                    operationId: "triggerTestWebhook",
                    summary: "Trigger a test webhook",
                    description: "Sends a `webhook.test` event to the registered webhook URL.\n\n" + "The request body contains `{ id, type: \"webhook.test\", timestamp, payload: { message: \"test\" } }`.",
                    parameters: [{
                        in: "path", name: "id", required: true, schema: {type: "string"}
                    }],
                    responses: {
                        200: {
                            description: "Test webhook dispatched", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/WebhookTestResponse"}
                                }
                            }
                        }, 404: {
                            description: "Webhook not found", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }, 429: {
                            description: "Test webhook rate limit exceeded", content: {
                                "application/json": {
                                    schema: {$ref: "#/components/schemas/ErrorResponse"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }, apis: []
};

export const swaggerSpec = swaggerJSDoc(options);
