import "dotenv/config";
import Joi from "joi";

const schema = Joi.object({
    PORT: Joi.number().default(8095),
    NODE_ENV: Joi.string().valid("development", "production", "test").default("production"),
    CORS_ORIGIN: Joi.string().default("*"),
    HTTP_TIMEOUT_MS: Joi.number().default(15000),
    GLOBAL_RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
    GLOBAL_RATE_LIMIT_MAX: Joi.number().default(600),
    ROADMAP_RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
    ROADMAP_RATE_LIMIT_MAX: Joi.number().default(60),
    WEBHOOK_RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
    WEBHOOK_RATE_LIMIT_MAX: Joi.number().default(60),
    LOG_PRETTY: Joi.when("NODE_ENV", {
        is: "production",
        then: Joi.boolean().truthy("true").falsy("false").default(false),
        otherwise: Joi.boolean().truthy("true").falsy("false").default(true)
    }),
    ERROR_EXPOSE_DETAILS: Joi.boolean().truthy("true").falsy("false").default(false),
    SWAGGER_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
    SWAGGER_SERVER_URL: Joi.string().uri().optional(),
    TRUST_PROXY: Joi.alternatives().try(Joi.string(), Joi.number().integer()).default("loopback"),
    HIVE_BASE_URL: Joi.string().uri().default("https://updates.playhive.com"),
    HIVE_ORGANIZATION_SLUG: Joi.string().default("hivegameslimited"),
    WEBHOOK_DEFAULT_SECRET: Joi.string().min(16).optional(),
    WEBHOOK_HTTP_TIMEOUT_MS: Joi.number().default(5000)
})
    .unknown(true);

const {value, error} = schema.validate(process.env, {abortEarly: false});
if (error) {
    console.error("Invalid env:", error.message);
    process.exit(1);
}

export const env = value;
