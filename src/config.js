/**
 * Loads the frontend configuration from .config.json.
 * Import and use `config` wherever the API base URL is needed.
 * @module config
 */
import configData from '../.config.json';

/** @type {{ apiBase: string }} */
const config = configData;
export default config;
