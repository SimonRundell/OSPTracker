/**
 * Loads the frontend configuration from the backend config endpoint.
 * Import and use `getConfig()` wherever the API base URL is needed.
 * @module config
 */

/** @type {{ apiBase: string } | null} */
let cachedConfig = null;
/** @type {Promise<{ apiBase: string }> | null} */
let configPromise = null;

function getConfigUrl() {
	const base = import.meta.env.BASE_URL || '/';
	const normalizedBase = base.endsWith('/') ? base : `${base}/`;
	return `${normalizedBase}api/config.php`;
}

async function loadConfig() {
	const response = await fetch(getConfigUrl(), { cache: 'no-store' });
	if (!response.ok) {
		throw new Error('Failed to load configuration.');
	}
	const data = await response.json();
	if (!data || !data.apiBase) {
		throw new Error('Configuration is missing apiBase.');
	}
	cachedConfig = data;
	return cachedConfig;
}

export function getConfig() {
	if (cachedConfig) return Promise.resolve(cachedConfig);
	if (!configPromise) configPromise = loadConfig();
	return configPromise;
}
